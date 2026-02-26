<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="LanGenerikoaGehitu.aspx.vb" Inherits="Lab3.LanGenerikoaGehitu" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>Lan Generikoa Gehitu</title>
<style>
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background: linear-gradient(to bottom right, #f5f5f7, #e0e0e5);
        margin: 0;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #1d1d1f;
        animation: fadeBody 1s ease forwards;
    }

    @keyframes fadeBody {
        from {opacity:0;}
        to {opacity:1;}
    }

    .card {
        background-color: rgba(255,255,255,0.95);
        border-radius: 20px;
        padding: 40px 30px;
        width: 100%;
        max-width: 500px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        display: flex;
        flex-direction: column;
        gap: 20px;
        transform: scale(0.95);
        animation: fadeScale 0.8s cubic-bezier(0.16,1,0.3,1) forwards;
    }

    @keyframes fadeScale {
        to {opacity:1; transform: scale(1);}
    }

    .card h1 {
        font-size: 24px;
        font-weight: 700;
        margin: 0;
        text-align: center;
        background: linear-gradient(90deg, #1d1d1f, #434344);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .card p {
        font-size: 16px;
        text-align: center;
        color: #666;
        margin: 0;
    }

    .inputs {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .inputs label {
        font-weight: 500;
    }

    .inputs input[type="text"], .inputs select {
        padding: 12px;
        font-size: 16px;
        border-radius: 12px;
        border: 1px solid #ccc;
        transition: all 0.2s ease;
    }

    .inputs input:focus, .inputs select:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(0,113,227,0.3);
    }

    .btn {
        background-color: #0071e3;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        border: none;
        padding: 14px;
        font-size: 16px;
        border-radius: 12px;
        transition: all 0.2s ease;
    }

    .btn:hover {
        background-color: #005fcc;
        transform: translateY(-2px);
        box-shadow: 0 6px 15px rgba(0,0,0,0.2);
    }

    .link {
        display: inline-block;
        margin-top: 10px;
        font-size: 16px;
        color: #0071e3;
        text-decoration: none;
        transition: all 0.2s ease;
    }

    .link:hover {
        color: #005fcc;
        transform: translateY(-2px);
    }

    .hidden-label {
        display: none;
    }
</style>
</head>
<body>
    <form id="form1" runat="server">
        <div class="card">
            <h1>Lan Generikoa Gehitu</h1>
            <div class="inputs">
                <label>Kodea:</label>
                <asp:TextBox ID="TextBox1" runat="server"></asp:TextBox>

                <label>Deskribapena:</label>
                <asp:TextBox ID="TextBox2" runat="server"></asp:TextBox>

                <label>Irakasgaia:</label>
                <asp:DropDownList ID="DropDownList2" runat="server" DataSourceID="odsDatuAtzipena" DataTextField="kodea" DataValueField="kodea"></asp:DropDownList>

                <label>Aurreik. orduak:</label>
                <asp:TextBox ID="TextBox3" runat="server"></asp:TextBox>

                <label>Lan mota:</label>
                <asp:DropDownList ID="DropDownList1" runat="server">
                    <asp:ListItem Value="Ariketa">Ariketa</asp:ListItem>
                    <asp:ListItem Value="Proiektua">Azterketa</asp:ListItem>
                    <asp:ListItem Value="Azterketa">Laborategia</asp:ListItem>
                    <asp:ListItem Value="Azterketa">Lana</asp:ListItem>
                </asp:DropDownList>
            </div>

            <asp:Button ID="Button1" runat="server" Text="Gehitu lana" CssClass="btn" />

            <asp:HyperLink ID="HyperLink1" runat="server" CssClass="link">Ikusi lanak</asp:HyperLink>

            <asp:Label ID="Label1" runat="server" CssClass="hidden-label"></asp:Label>

            <asp:ObjectDataSource
                ID="odsDatuAtzipena"
                runat="server"
                TypeName="loginetaerregistratu.DatuAtzipena"
                SelectMethod="IrakasgaiKodeenTaulaLortu">
            </asp:ObjectDataSource>
        </div>
    </form>
</body>
</html>