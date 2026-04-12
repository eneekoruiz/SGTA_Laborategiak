<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="Erregistratu.aspx.vb" Inherits="Lab3.Erregistratu" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Erregistratu</title>
    
    <style>
       
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f5f5f7; 
            color: #1d1d1f;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            -webkit-font-smoothing: antialiased; 
        }

       
        .apple-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(20px); 
            -webkit-backdrop-filter: blur(20px);
            width: 100%;
            max-width: 420px;
            padding: 50px 40px;
            border-radius: 24px; 
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08); 
            border: 1px solid rgba(255, 255, 255, 0.6);
            
            
            opacity: 0;
            transform: translateY(20px);
            animation: floatUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes floatUp {
            to { opacity: 1; transform: translateY(0); }
        }

        .apple-card h1 {
            font-size: 28px;
            font-weight: 600;
            text-align: center;
            margin-bottom: 40px;
            letter-spacing: -0.5px;
        }

        
        .input-group {
            margin-bottom: 20px;
            position: relative;
        }

        .input-label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: #86868b;
            margin-bottom: 8px;
            margin-left: 4px;
            transition: color 0.3s;
        }

        .apple-input {
            width: 100%;
            padding: 16px;
            font-size: 17px; 
            background-color: #f5f5f7; 
            border: 1px solid transparent;
            border-radius: 12px;
            color: #1d1d1f;
            box-sizing: border-box;
            outline: none;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .apple-input:focus {
            background-color: #ffffff;
            border-color: #0071e3; 
            box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.15);
            transform: scale(1.01); 
        }

        .apple-input:focus + .input-label {
            color: #0071e3;
        }

        
        .apple-btn {
            width: 100%;
            padding: 18px;
            margin-top: 20px;
            background-color: #0071e3; 
            color: white;
            font-size: 17px;
            font-weight: 500;
            border: none;
            border-radius: 99px; 
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 113, 227, 0.3);
        }

        .apple-btn:hover {
            background-color: #0077ED;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 113, 227, 0.4);
        }

        .apple-btn:active {
            transform: scale(0.97);
        }

       
        .message-area {
            text-align: center;
            margin-top: 20px;
            font-size: 14px;
            color: #e30000; 
        }

        .row {
            display: flex;
            gap: 15px;
        }
        
        .col {
            flex: 1;
        }

        a {
            color: #0071e3;
            text-decoration: none;
            font-size: 14px;
        }
        a:hover { text-decoration: underline; }

    </style>
</head>
<body>
    <form id="form1" runat="server">
        <div class="apple-card">
            <h1>Erregistratu</h1>

            <div class="input-group">
                <span class="input-label">Emaila</span>
                <asp:TextBox ID="TextBox1" runat="server" CssClass="apple-input" placeholder="izena@adibidea.com"></asp:TextBox>
            </div>

            <div class="row">
                <div class="col">
                    <div class="input-group">
                        <span class="input-label">Izena</span>
                        <asp:TextBox ID="TextBox2" runat="server" CssClass="apple-input"></asp:TextBox>
                    </div>
                </div>
                <div class="col">
                    <div class="input-group">
                        <span class="input-label">Abizena</span>
                        <asp:TextBox ID="TextBox3" runat="server" CssClass="apple-input"></asp:TextBox>
                    </div>
                </div>
            </div>

            <div class="input-group">
                <span class="input-label">Nortasun Agiria (NA)</span>
                <asp:TextBox ID="TextBox6" runat="server" CssClass="apple-input"></asp:TextBox>
            </div>

            <div class="input-group">
                <span class="input-label">Galdera Ezkutua</span>
                <asp:TextBox ID="TextBox4" runat="server" CssClass="apple-input"></asp:TextBox>
            </div>

            <div class="input-group">
                <span class="input-label">Erantzuna</span>
                <asp:TextBox ID="TextBox5" runat="server" CssClass="apple-input" TextMode="Password"></asp:TextBox>
            </div>

            <div class="input-group">
                <span class="input-label">Pasahitza</span>
                <asp:TextBox ID="TextBox7" runat="server" CssClass="apple-input" TextMode="Password"></asp:TextBox>
            </div>

            <asp:Button ID="Button1" runat="server" Text="Sortu Kontua" CssClass="apple-btn" />

            <div class="message-area">
                <asp:Label ID="Label1" runat="server"></asp:Label>
                <br /><br />
                <asp:HyperLink ID="hlEgiaztatu" runat="server" Visible="false">Egiaztatu orain</asp:HyperLink>
            </div>
        </div>
    </form>
</body>
</html>