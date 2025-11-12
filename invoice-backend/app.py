from flask import Flask, jsonify, request
from flask_cors import CORS
from config import Config
from models import db, Invoice, InvoiceItem
from datetime import datetime
from docxtpl import DocxTemplate
import os

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for React frontend
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:5173"]}})

db.init_app(app)

@app.route('/')
def home():
    return jsonify({"message": "Invoice Generator API", "status": "running"})

@app.route('/api/health')
def health():
    return jsonify({"status": "healthy"})

# CREATE - Add new invoice
@app.route('/api/invoices', methods=['POST'])
def create_invoice():
    try:
        data = request.get_json()
        
        # Get the last invoice_id and increment
        last_invoice = Invoice.query.order_by(Invoice.invoice_id.desc()).first()
        new_invoice_id = (last_invoice.invoice_id + 1) if last_invoice else 1
        
        # Calculate totals
        subtotal = sum(item['line_total'] for item in data['items'])
        salestax = float(data.get('salestax', 0.10))  # Default 10%
        total = subtotal + (subtotal * salestax)
        
        # Create invoice
        invoice = Invoice(
            invoice_id=new_invoice_id,
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone=data['phone'],
            subtotal=subtotal,
            salestax=salestax,
            total=total
        )
        
        db.session.add(invoice)
        db.session.flush()  # Get the invoice ID
        
        # Create invoice items
        for item_data in data['items']:
            item = InvoiceItem(
                invoice_id=invoice.id,
                quantity=item_data['quantity'],
                description=item_data['description'],
                unit_price=item_data['unit_price'],
                line_total=item_data['line_total']
            )
            db.session.add(item)
        
        db.session.commit()
        
        return jsonify({
            "message": "Invoice created successfully",
            "invoice_id": invoice.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

# READ ALL - Get all invoices
@app.route('/api/invoices', methods=['GET'])
def get_invoices():
    try:
        invoices = Invoice.query.all()
        result = []
        
        for invoice in invoices:
            result.append({
                'id': invoice.id,
                'invoice_id': invoice.invoice_id,
                'first_name': invoice.first_name,
                'last_name': invoice.last_name,
                'phone': invoice.phone,
                'subtotal': float(invoice.subtotal),
                'salestax': float(invoice.salestax),
                'total': float(invoice.total),
                'created_at': invoice.created_at.isoformat(),
                'items_count': len(invoice.items)
            })
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# READ ONE - Get specific invoice
@app.route('/api/invoices/<int:id>', methods=['GET'])
def get_invoice(id):
    try:
        invoice = Invoice.query.get(id)
        
        if not invoice:
            return jsonify({"error": "Invoice not found"}), 404
        
        items = []
        for item in invoice.items:
            items.append({
                'quantity': item.quantity,
                'description': item.description,
                'unit_price': float(item.unit_price),
                'line_total': float(item.line_total)
            })
        
        result = {
            'id': invoice.id,
            'invoice_id': invoice.invoice_id,
            'first_name': invoice.first_name,
            'last_name': invoice.last_name,
            'phone': invoice.phone,
            'subtotal': float(invoice.subtotal),
            'salestax': float(invoice.salestax),
            'total': float(invoice.total),
            'created_at': invoice.created_at.isoformat(),
            'items': items
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# DELETE - Delete invoice
@app.route('/api/invoices/<int:id>', methods=['DELETE'])
def delete_invoice(id):
    try:
        invoice = Invoice.query.get(id)
        
        if not invoice:
            return jsonify({"error": "Invoice not found"}), 404
        
        db.session.delete(invoice)
        db.session.commit()
        
        return jsonify({"message": "Invoice deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

# GENERATE DOCX - Generate invoice document
@app.route('/api/invoices/<int:id>/generate', methods=['POST'])
def generate_invoice(id):
    try:
        invoice = Invoice.query.get(id)
        
        if not invoice:
            return jsonify({"error": "Invoice not found"}), 404
        
        # Check if template exists
        template_path = 'invoice_template.docx'
        if not os.path.exists(template_path):
            return jsonify({"error": "Invoice template not found"}), 404
        
        # Prepare data for template
        doc = DocxTemplate(template_path)
        
        invoice_list = []
        for item in invoice.items:
            invoice_list.append([
                item.quantity,
                item.description,
                float(item.unit_price),
                float(item.line_total)
            ])
        
        context = {
            'name': f"{invoice.first_name} {invoice.last_name}",
            'phone': invoice.phone,
            'invoice_list': invoice_list,
            'subtotal': float(invoice.subtotal),
            'salestax': f"{float(invoice.salestax) * 100}%",
            'total': float(invoice.total)
        }
        
        doc.render(context)
        
        # Save generated invoice
        output_filename = f'invoice_{invoice.invoice_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.docx'
        output_path = os.path.join('generated_invoices', output_filename)
        
        # Create directory if it doesn't exist
        os.makedirs('generated_invoices', exist_ok=True)
        
        doc.save(output_path)
        
        return jsonify({
            "message": "Invoice generated successfully",
            "filename": output_filename,
            "download_url": f"/api/download/{output_filename}"
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# NEW - Download generated invoice
@app.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    try:
        file_path = os.path.join('generated_invoices', filename)
        if os.path.exists(file_path):
            return send_file(
                file_path,
                as_attachment=True,
                download_name=filename
            )
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
