function generateClientStatusEmailHTML(email, status) {
    const isAccepted = status === 'accepted';
    const signInUrl = 'https://www.microsoftsupplier.com/Sign-in';
  
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Registration ${isAccepted ? 'Approved' : 'Declined'}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          background-color: #f6f6f6;
          color: #333;
        }
        .banner {
          width: 100%;
          height: 160px;
          background-image: url("https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2Fimage.png?alt=media&token=104e6658-bbf5-482e-8f0a-314a9d3875e0");
          background-size: cover;
          background-position: center;
        }
        .container {
          max-width: 600px;
          margin: -40px auto 40px;
          background: #ffffff;
          padding: 30px;
          text-align: center;
          border-radius: 6px;
        }
        .title {
          font-size: 22px;
          font-weight: bold;
          margin-bottom: 20px;
          color: ${isAccepted ? '#2e7d32' : '#c62828'};
        }
        .message {
          font-size: 15px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .btn {
          display: inline-block;
          padding: 12px 24px;
          background-color: #00A9E0;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
        }
        .footer img {
          width: 200px;
        }
      </style>
    </head>
    <body>
      <div class="banner"></div>
  
      <div class="container">
        <div class="title">
          Registration ${isAccepted ? 'Approved' : 'Declined'}
        </div>
  
        <div class="message">
          ${
            isAccepted
              ? `Your registration request associated with <strong>${email}</strong> has been approved.
                 You can now sign in and start using the platform.`
              : `We regret to inform you that your registration request associated with
                 <strong>${email}</strong> has been declined.`
          }
        </div>
  
        ${
          isAccepted
            ? `<a href="${signInUrl}" class="btn">Sign In Now</a>`
            : ``
        }
  
        <div class="footer">
          <img src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0" />
        </div>
      </div>
    </body>
    </html>
    `;
  }
  
  export default generateClientStatusEmailHTML;
  