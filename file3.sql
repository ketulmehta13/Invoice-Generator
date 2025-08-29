select * from invoices;

use invoice_db;

CREATE TABLE invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(15),
    quantity INT,
    description TEXT,
    unit_price DECIMAL(10,2),
    line_total DECIMAL(10,2),
    subtotal DECIMAL(10,2),
    salestax DECIMAL(5,2),
    total DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);