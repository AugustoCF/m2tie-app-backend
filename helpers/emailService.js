const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD 
  }
});

const sendResetEmail = async (email, token) => {
  const resetURL = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Recuperação de Senha',
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Redefinição de Senha</h2>
                <p>Você solicitou a redefinição de senha da sua conta.</p>
                <p>Clique no botão abaixo para redefinir sua senha (válido por 1 hora):</p>
                <a href="${resetURL}" 
                   style="display: inline-block; padding: 12px 24px; background-color: #007bff; 
                          color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                    Redefinir Senha
                </a>
                <p>Ou copie e cole este link no navegador:</p>
                <p style="color: #666; word-break: break-all;">${resetURL}</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
                <p style="color: #999; font-size: 12px;">
                    Se você não solicitou esta redefinição, ignore este e-mail. 
                    Sua senha permanecerá inalterada.
                </p>
            </div>
        `
  };

  try {
        await transporter.sendMail(mailOptions);
        console.log('Email enviado com sucesso para:', email);
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        throw new Error('Erro ao enviar email de recuperação');
    }
};

module.exports = { sendResetEmail };