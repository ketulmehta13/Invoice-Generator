import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = 'http://localhost:5000/api'

function App() {
  const [invoices, setInvoices] = useState([])
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    salestax: 10 // Store as percentage (10 means 10%)
  })
  const [items, setItems] = useState([
    { quantity: 1, description: '', unit_price: '', line_total: 0 }
  ])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const response = await axios.get(`${API_URL}/invoices`)
      setInvoices(response.data)
    } catch (error) {
      console.error('Error fetching invoices:', error)
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    
    if (field === 'quantity') {
      newItems[index][field] = value === '' ? '' : parseInt(value)
    } else if (field === 'unit_price') {
      newItems[index][field] = value === '' ? '' : value
    } else {
      newItems[index][field] = value
    }
    
    // Calculate line total
    const qty = newItems[index].quantity === '' ? 0 : newItems[index].quantity
    const price = newItems[index].unit_price === '' ? 0 : parseFloat(newItems[index].unit_price)
    newItems[index].line_total = qty * price
    
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { quantity: 1, description: '', unit_price: '', line_total: 0 }])
  }

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Prepare items with proper number conversion
      const preparedItems = items.map(item => ({
        quantity: parseInt(item.quantity) || 0,
        description: item.description,
        unit_price: parseFloat(item.unit_price) || 0,
        line_total: parseFloat(item.line_total) || 0
      }))

      const invoiceData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        salestax: parseFloat(formData.salestax) / 100, // Convert percentage to decimal
        items: preparedItems
      }

      const response = await axios.post(`${API_URL}/invoices`, invoiceData)
      setMessage('✅ Invoice created successfully! ID: ' + response.data.invoice_id)
      
      // Reset form
      setFormData({ first_name: '', last_name: '', phone: '', salestax: 10 })
      setItems([{ quantity: 1, description: '', unit_price: '', line_total: 0 }])
      
      fetchInvoices()
    } catch (error) {
      setMessage('❌ Error: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  const deleteInvoice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return
    
    try {
      await axios.delete(`${API_URL}/invoices/${id}`)
      setMessage('✅ Invoice deleted successfully')
      fetchInvoices()
    } catch (error) {
      setMessage('❌ Error deleting invoice: ' + error.message)
    }
  }

  const generateDocument = async (id) => {
    try {
      setMessage('⏳ Generating document...')
      const response = await axios.post(`${API_URL}/invoices/${id}/generate`)
      
      // Download the file
      const downloadUrl = `http://localhost:5000${response.data.download_url}`
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = response.data.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setMessage('✅ Document generated and downloaded: ' + response.data.filename)
    } catch (error) {
      setMessage('❌ Error generating document: ' + error.message)
    }
  }

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0)
  const tax = subtotal * (parseFloat(formData.salestax) / 100)
  const total = subtotal + tax

  return (
    <div className="App">
      <header>
        <h1>📄 Invoice Generator</h1>
        <p>Create and manage your invoices with ease</p>
      </header>

      <div className="container">
        {/* Invoice Form */}
        <div className="form-section">
          <h2>📝 Create New Invoice</h2>
          
          {message && (
            <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="Enter first name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Enter last name"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                  required
                />
              </div>

              <div className="form-group">
                <label>Sales Tax (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="salestax"
                  value={formData.salestax}
                  onChange={(e) => setFormData({...formData, salestax: e.target.value})}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="items-section">
              <h3>🛒 Invoice Items</h3>
              <div className="items-header">
                <span>Qty</span>
                <span>Description</span>
                <span>Unit Price</span>
                <span>Total</span>
                <span></span>
              </div>
              
              {items.map((item, index) => (
                <div key={index} className="item-row">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    placeholder="1"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    value={`$${(item.line_total || 0).toFixed(2)}`}
                    readOnly
                    className="readonly"
                  />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className="remove-btn" title="Remove item">
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button type="button" onClick={addItem} className="add-item-btn">
                ➕ Add Another Item
              </button>
            </div>

            <div className="totals-box">
              <div className="totals-row">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="totals-row">
                <span>Tax ({parseFloat(formData.salestax || 0).toFixed(1)}%):</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="totals-row total-row">
                <span>Total Amount:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? '⏳ Creating Invoice...' : '✅ Create Invoice'}
            </button>
          </form>
        </div>

        {/* Invoice List */}
        <div className="list-section">
          <h2>📋 Invoices ({invoices.length})</h2>
          
          {invoices.length === 0 ? (
            <div className="no-invoices">
              <p>📭 No invoices yet</p>
              <p>Create your first invoice using the form!</p>
            </div>
          ) : (
            <div className="invoice-list">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="invoice-card">
                  <div className="invoice-header">
                    <h3>Invoice #{invoice.invoice_id}</h3>
                    <span className="invoice-badge">${parseFloat(invoice.total).toFixed(2)}</span>
                  </div>
                  
                  <div className="invoice-body">
                    <p><strong>👤 {invoice.first_name} {invoice.last_name}</strong></p>
                    <p>📞 {invoice.phone}</p>
                    <p>📦 {invoice.items_count} item(s)</p>
                    <p className="date">📅 {new Date(invoice.created_at).toLocaleString()}</p>
                  </div>
                  
                  <div className="actions">
                    <button onClick={() => generateDocument(invoice.id)} className="generate-btn">
                      📥 Download
                    </button>
                    <button onClick={() => deleteInvoice(invoice.id)} className="delete-btn">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
