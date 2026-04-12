<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="PasahitzaAldatu.aspx.vb" Inherits="ErabiltzaileErregistratuak.PasahitzaAldatu" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Pasahitza Aldatu</title>
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

        .card {
            background-color: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            padding: 50px 40px;
            width: 100%;
            max-width: 380px;
            border-radius: 24px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.5);
            text-align: center;
            animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
            transform: scale(0.98);
        }

        @keyframes fadeIn {
            to { opacity: 1; transform: scale(1); }
        }

        h2 {
            margin-top: 0;
            margin-bottom: 30px;
            font-size: 24px;
            font-weight: 600;
        }

        .input-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .label-text {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 600;
            color: #86868b;
            margin-left: 5px;
        }

        .apple-input {
            width: 100%;
            padding: 16px;
            font-size: 16px;
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
            font-size: 16px;
            font-weight: 600;
            border: none;
            border-radius: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .btn-primary:hover {
            background-color: #0077ED;
        }

        .btn-secondary {
            width: 100%;
            padding: 12px;
            margin-top: 10px;
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

        .message-label {
            display: block;
            margin-top: 20px;
            font-size: 14px;
            font-weight: 500;
            min-height: 20px;
        }
    </style>
</head>
<body>
    <form id="form1" runat="server">
        <div class="card">
            <h2>Aldatu Pasahitza</h2>
            
            <div class="input-group">
                <asp:Label ID="Label1" runat="server" Text="Uneko pasahitza" CssClass="label-text"></asp:Label>
                <asp:TextBox ID="TextBox1" runat="server" CssClass="apple-input" TextMode="Password"></asp:TextBox>
            </div>
            
            <div class="input-group">
                <asp:Label ID="Label2" runat="server" Text="Pasahitza berria" CssClass="label-text"></asp:Label>
                <asp:TextBox ID="TextBox3" runat="server" CssClass="apple-input" TextMode="Password"></asp:TextBox>
            </div>

            <div class="input-group">
                <asp:Label ID="Label3" runat="server" Text="Berriro errepikatu" CssClass="label-text"></asp:Label>
                <asp:TextBox ID="TextBox2" runat="server" CssClass="apple-input" TextMode="Password"></asp:TextBox>
            </div>

            <asp:Button ID="Button1" runat="server" Text="Gorde Aldaketak" CssClass="btn-primary" />
            <asp:Button ID="Button2" runat="server" Text="Itzuli Login-era" CssClass="btn-secondary" />

            <asp:Label ID="Label4" runat="server" CssClass="message-label"></asp:Label>
        </div>
    </form>
</body>
</html>