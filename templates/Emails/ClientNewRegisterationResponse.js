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
          background-image: url("https://yaodjyiimubilqhamwlx.supabase.co/storage/v1/object/sign/MS%20Files/sertic-banner.webp?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iOGZhOGVlZi01NmI4LTRlYjUtOGJjYS1lZjFjYTlkZDkyOGMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNUyBGaWxlcy9zZXJ0aWMtYmFubmVyLndlYnAiLCJpYXQiOjE3NzcyMDc2ODUsImV4cCI6NDkzMDgwNzY4NX0.4UidB3UAPmwMoLaMH3v9nm_W4zPpGR4Jf8yPRXfHegM");
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
          <img src="https://yaodjyiimubilqhamwlx.supabase.co/storage/v1/object/sign/MS%20Files/Screenshot%202026-04-26%20at%204.34.42%20PM.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iOGZhOGVlZi01NmI4LTRlYjUtOGJjYS1lZjFjYTlkZDkyOGMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNUyBGaWxlcy9TY3JlZW5zaG90IDIwMjYtMDQtMjYgYXQgNC4zNC40MiBQTS5wbmciLCJpYXQiOjE3NzcyMDcxODQsImV4cCI6NDkzMDgwNzE4NH0.cyDgOySfJl4Wb_cMRKXHTApYt-aI1U9ymPJeALha8Hk" />
        </div>
      </div>
    </body>
    </html>
    `;
  }
  
  export default generateClientStatusEmailHTML;
  