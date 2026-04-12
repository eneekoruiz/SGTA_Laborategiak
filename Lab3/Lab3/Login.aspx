<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="Login.aspx.vb" Inherits="Lab3.Login" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Saioa Hasi</title>
    <style>
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f5f5f7;
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #1d1d1f;
        }

        
        .login-card {
            background-color: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            padding: 48px;
            width: 100%;
            max-width: 360px;
            border-radius: 24px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.5);
            text-align: center;
            
            
            opacity: 0;
            transform: scale(0.98) translateY(10px);
            animation: popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes popIn {
            to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .login-card h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            margin-top: 0;
            letter-spacing: -0.5px;
        }

        .subtitle {
            font-size: 15px;
            color: #86868b;
            margin-bottom: 32px;
        }

        
        .input-group {
            margin-bottom: 16px;
            text-align: left;
        }

        .input-label {
            display: block;
            margin-bottom: 6px;
            font-size: 12px;
            font-weight: 600;
            color: #86868b;
            margin-left: 10px;
        }

        .apple-input {
            width: 100%;
            padding: 16px 20px;
            font-size: 17px;
            background-color: #f2f2f7; 
            border: 1px solid transparent;
            border-radius: 14px;
            box-sizing: border-box;
            outline: none;
            transition: all 0.2s ease;
        }

        .apple-input:focus {
            background-color: #ffffff;
            border-color: #0071e3;
            box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.15);
        }

       
        .btn-primary {
            width: 100%;
            padding: 16px;
            margin-top: 10px;
            background-color: #0071e3; 
            color: white;
            font-size: 17px;
            font-weight: 600;
            border: none;
            border-radius: 14px;
            cursor: pointer;
            transition: transform 0.1s, background-color 0.2s;
        }

        .btn-primary:hover {
            background-color: #0077ED;
        }
        
        .btn-primary:active {
            transform: scale(0.98);
        }

        
        .btn-secondary {
            width: 100%;
            padding: 12px;
            margin-top: 12px;
            background-color: transparent;
            color: #0071e3;
            font-size: 15px;
            font-weight: 500;
            border: none;
            cursor: pointer;
        }

        .btn-secondary:hover {
            text-decoration: underline;
        }

        
        .forgot-password {
            display: block;
            margin-top: 20px;
            font-size: 13px;
            color: #86868b;
            text-decoration: none;
        }

        .forgot-password:hover {
            color: #1d1d1f;
        }

        .error-message {
            display: block;
            margin-top: 15px;
            color: #ff3b30; 
            font-size: 13px;
            font-weight: 500;
        }
        
        .divider {
            margin: 20px 0;
            height: 1px;
            background-color: #e5e5ea;
        }

    </style>
</head>
<body>

    <form id="form1" runat="server">
        <div class="login-card">
            <h1>Ongi etorri</h1>
            <div class="subtitle">Sartu zure datuak jarraitzeko</div>

            <div class="input-group">
                <span class="input-label">Emaila</span>
                <asp:TextBox ID="txtEmail" runat="server" CssClass="apple-input" placeholder="zure@emaila.com"></asp:TextBox>
            </div>

            <div class="input-group">
                <span class="input-label">Pasahitza</span>
                <asp:TextBox ID="txtPassword" runat="server" CssClass="apple-input" TextMode="Password" placeholder="••••••••"></asp:TextBox>
            </div>

            <asp:Button ID="Button2" runat="server" Text="Saioa Hasi" CssClass="btn-primary" />
            
            <asp:HyperLink ID="HyperLink1" runat="server" CssClass="forgot-password">Pasahitza ahaztu duzu?</asp:HyperLink>

            <asp:Label ID="Label1" runat="server" CssClass="error-message"></asp:Label>

            <div class="divider"></div>

            <span style="font-size: 13px; color: #86868b;">Ez duzu konturik?</span>
            <asp:Button ID="Button1" runat="server" Text="Sortu kontu berria" CssClass="btn-secondary" />
        </div>
    </form>
</body>
</html>