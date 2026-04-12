<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="Menua.aspx.vb" Inherits="ErabiltzaileErregistratuak.Menua" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title></title>
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
            padding: 50px 40px;
            width: 100%;
            max-width: 320px;
            border-radius: 24px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.5);
            text-align: center;
            animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }

        p {
            margin: 15px 0;
        }

        a {
            display: block;
            padding: 18px;
            background-color: #ffffff;
            color: #0071e3;
            font-size: 17px;
            font-weight: 500;
            text-decoration: none;
            border-radius: 16px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.03);
            transition: all 0.2s ease;
        }

        a:hover {
            background-color: #0071e3;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 113, 227, 0.3);
        }

        a:active {
            transform: scale(0.98);
        }
    </style>
</head>
<body>
    <form id="form1" runat="server">
        <div>
        </div>
        <p>
            <asp:HyperLink ID="HyperLink1" runat="server">Pasahitza aldatu</asp:HyperLink>
        </p>
        <p>
            <asp:HyperLink ID="HyperLink2" runat="server">Amaierara joan</asp:HyperLink>
        </p>
    </form>
</body>
</html>