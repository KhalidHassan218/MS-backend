function generateRegistrationEmailHTML(user) {  
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>New Registration Request</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body {
          width: 100%;
          min-height: 100%;
          font-family: Arial, sans-serif;
          color: #333;
          line-height: 1.5;
        }
        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          aspect-ratio: 4 / 1;
          background-image: url("https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2Fimage.png?alt=media&token=104e6658-bbf5-482e-8f0a-314a9d3875e0");
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          padding: 0 40px;
          color: white;
        }
        .banner .left h1 {
          font-size: 32px;
          margin: 0;
          font-weight: 800;
        }
        .banner .right {
          text-align: right;
          font-size: 16px;
          line-height: 1.6;
        }
        .content {
          padding: 30px 40px;
          width: 100%;
        }
        .section-title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 20px;
          color: #00A9E0;
        }
        .user-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          font-size: 14px;
        }
        .user-table th {
          background: #00A9E0;
          color: white;
          padding: 12px 10px;
          text-align: left;
          font-weight: bold;
          text-transform: uppercase;
        }
        .user-table td {
          padding: 12px 10px;
          border-bottom: 1px solid #e0e0e0;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
        }
        .signature-section {
          margin-top: 30px;
          text-align: center;
        }
        .signature-image img {
          width: 80px;
          margin-bottom: 10px;
        }
        .signature-label {
          font-weight: bold;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="banner">
        <div class="left">
          <h1>Sertic Platform</h1>
        </div>
        <div class="right">
          <div><strong>New Registration Request</strong></div>
          <div>Admin Notification</div>
        </div>
      </div>
  
      <div class="content">
        <div class="section-title">A New User Has Requested Access</div>
  
        <p style="margin-bottom:20px;">
          A new user has submitted a registration request on your platform.
          Review their information below and choose whether to approve or decline.
        </p>
  
        <table class="user-table">
          <thead>
            <tr>
              <th>FIELD</th>
              <th>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Email Address</td>
              <td>${user.email || "-"}</td>
            </tr>
            <tr>
              <td>Company</td>
              <td>${user.company || "-"}</td>
            </tr>
            <tr>
              <td>Country</td>
              <td>${user.country || "-"}</td>
            </tr>
            <tr>
              <td>Tax ID</td>
              <td>${user.type || "-"}</td>
            </tr>
          </tbody>
        </table>
  
        <div style="margin-top:30px;">
          <p>You can now log in to the admin dashboard to approve or deny the registration request.</p>
        </div>
  
        <div class="signature-section">
          <div class="signature-image">
            <img src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2Fsergio-signature.png?alt=media&token=18a1b49b-ae58-4494-b99d-34f3c32fae73" />
          </div>
          <div class="signature-label">Sertic Administration</div>
        </div>
  
        <div class="footer">
          <img src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0" width="200">
        </div>
      </div>
    </body>
    </html>
    `;
  }
  
  module.exports = generateRegistrationEmailHTML;
  