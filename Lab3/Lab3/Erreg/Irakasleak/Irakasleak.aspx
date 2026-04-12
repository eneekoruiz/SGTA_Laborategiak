<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="Irakasleak.aspx.vb" Inherits="Lab3.Irakasleak" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Irakasleak</title>
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

        .welcome-card {
            background-color: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            padding: 60px 40px;
            width: 100%;
            max-width: 340px;
            border-radius: 30px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.5);
            text-align: center;
            opacity: 0;
            transform: scale(0.95);
            animation: fadeInZoom 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fadeInZoom {
            to { opacity: 1; transform: scale(1); }
        }

        .welcome-card h1 {
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 10px 0;
            background: -webkit-linear-gradient(#1d1d1f, #434344);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .welcome-card p {
            font-size: 17px;
            color: #86868b;
            margin-bottom: 30px;
            line-height: 1.4;
        }

        .link-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
            margin-top: 25px;
        }

        .plain-link {
            font-size: 17px;
            color: #0071e3;
            text-decoration: none;
            transition: all 0.2s ease;
        }

        .plain-link:hover {
            text-decoration: underline;
            color: #0077ED;
        }
    </style>
</head>
<body>
    <form id="form1" runat="server">
        <div class="welcome-card">
            <h1>Irakasleak</h1>
            <p>Lanen kudeaketa</p>

            <div class="link-list">
                <asp:HyperLink ID="HyperLink1" runat="server" CssClass="plain-link">Irakasgaiak</asp:HyperLink>
                <asp:HyperLink ID="HyperLink2" runat="server" CssClass="plain-link">Lanak</asp:HyperLink>
                <asp:HyperLink ID="HyperLink4" runat="server" CssClass="plain-link">Taldeak</asp:HyperLink>
                <asp:HyperLink ID="HyperLink3" runat="server" CssClass="plain-link">Pasahitza Aldatu</asp:HyperLink>
            </div>
        </div>
    </form>
</body>
</html>