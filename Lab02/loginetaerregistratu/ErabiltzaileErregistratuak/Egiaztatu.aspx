<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="Egiaztatu.aspx.vb" Inherits="ErabiltzaileErregistratuak.Egiaztatu" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Egiaztatu</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f5f5f7;
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        #form1 {
            background-color: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            padding: 60px 40px;
            width: 100%;
            max-width: 300px;
            border-radius: 24px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.5);
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }

        #Button1 {
            width: 100%;
            padding: 18px;
            background-color: #0071e3;
            color: white;
            font-size: 17px;
            font-weight: 600;
            border: none;
            border-radius: 99px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 113, 227, 0.3);
            margin-top: 10px;
        }

        #Button1:hover {
            background-color: #0077ED;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 113, 227, 0.4);
        }

        #Button1:active {
            transform: scale(0.98);
        }
    </style>
</head>
<body>
    <form id="form1" runat="server">
        <div>
        </div>
        <asp:Button ID="Button1" runat="server" Text="Aplikazioan sartu" />
    </form>
</body>
</html>