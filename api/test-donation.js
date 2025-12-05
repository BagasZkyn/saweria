/**
 * Test Donation Endpoint
 * Endpoint untuk testing - HANYA UNTUK DEVELOPMENT!
 * Hapus atau disable di production!
 */

module.exports = async (req, res) => {
  // DISABLE DI PRODUCTION!
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  if (req.method === 'GET') {
    // Return HTML form untuk testing
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Saweria Donation</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #FF6B6B;
            text-align: center;
          }
          .form-group {
            margin-bottom: 15px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
          }
          input, textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            box-sizing: border-box;
          }
          button {
            width: 100%;
            padding: 12px;
            background: #FF6B6B;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
          }
          button:hover {
            background: #ff5252;
          }
          .response {
            margin-top: 20px;
            padding: 15px;
            border-radius: 5px;
            display: none;
          }
          .success {
            background: #d4edda;
            color: #155724;
          }
          .error {
            background: #f8d7da;
            color: #721c24;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎁 Test Saweria Donation</h1>
          <p style="text-align: center; color: #666;">Gunakan form ini untuk testing webhook</p>
          
          <form id="donationForm">
            <div class="form-group">
              <label>Nama Donatur:</label>
              <input type="text" id="donor_name" value="TestUser123" required />
            </div>
            
            <div class="form-group">
              <label>Jumlah Donasi (Rp):</label>
              <input type="number" id="amount" value="10000" min="1" required />
            </div>
            
            <div class="form-group">
              <label>Pesan (opsional):</label>
              <textarea id="message" rows="3" placeholder="Semangat terus!"></textarea>
            </div>
            
            <button type="submit">Kirim Test Donation</button>
          </form>
          
          <div id="response" class="response"></div>
        </div>
        
        <script>
          document.getElementById('donationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const responseDiv = document.getElementById('response');
            responseDiv.style.display = 'none';
            
            const data = {
              donor_name: document.getElementById('donor_name').value,
              amount: parseInt(document.getElementById('amount').value),
              message: document.getElementById('message').value
            };
            
            try {
              const response = await fetch('/api/webhook', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
              });
              
              const result = await response.json();
              
              responseDiv.className = 'response ' + (response.ok ? 'success' : 'error');
              responseDiv.textContent = JSON.stringify(result, null, 2);
              responseDiv.style.display = 'block';
              
              if (response.ok) {
                // Reset form
                document.getElementById('message').value = '';
              }
            } catch (error) {
              responseDiv.className = 'response error';
              responseDiv.textContent = 'Error: ' + error.message;
              responseDiv.style.display = 'block';
            }
          });
        </script>
      </body>
      </html>
    `);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
