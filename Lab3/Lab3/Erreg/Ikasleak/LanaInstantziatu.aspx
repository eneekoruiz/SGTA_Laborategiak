<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="LanaInstantziatu.aspx.vb" Inherits="Lab3.LanaInstantziatu" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Lana Instantziatu</title>
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
            max-width: 720px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            gap: 25px;
            transform: scale(0.95);
            animation: fadeScale 0.8s cubic-bezier(0.16,1,0.3,1) forwards;
        }

        @keyframes fadeScale {
            to {opacity:1; transform: scale(1);}
        }

        .card h1 {
            font-size: 26px;
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
            gap: 15px;
        }

        .inputs input[type="text"], .inputs input[type="number"] {
            padding: 12px 15px;
            font-size: 16px;
            border-radius: 12px;
            border: 1px solid #ccc;
            transition: all 0.2s ease;
        }

        .inputs input:focus {
            outline: none;
            box-shadow: 0 0 0 2px rgba(0,113,227,0.3);
        }

        .menu-button {
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

        .menu-button:hover {
            background-color: #005fcc;
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(0,0,0,0.2);
        }

        .grid-container {
            overflow-x: auto;
            margin-top: 15px;
        }

        .grid-view {
            width: 100%;
            border-collapse: collapse;
            opacity: 0;
            transform: translateY(10px);
            animation: fadeInGrid 0.5s ease forwards 0.3s;
        }

        @keyframes fadeInGrid {
            to {opacity:1; transform: translateY(0);}
        }

        .grid-view th, .grid-view td {
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
            text-align: left;
        }

        .grid-view th {
            background-color: #f0f0f0;
            font-weight: 600;
        }

        .link-back {
            display: inline-block;
            margin-top: 15px;
            font-size: 16px;
            color: #0071e3;
            text-decoration: none;
            transition: all 0.2s ease;
        }

        .link-back:hover {
            color: #005fcc;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <form id="form1" runat="server">
        <div class="card">
            <h1>&nbsp;</h1>
            <h1>&nbsp;</h1>
            <h1>&nbsp;</h1>
            <h1>Ikasle Lan Generikoak</h1>
            <p>Instantziatu lana</p>

            <div class="inputs">
                Erabiltzailea
                <asp:TextBox ID="TextBox1" runat="server" CssClass="menu-input"></asp:TextBox>

                Lan generikoa
                <asp:TextBox ID="TextBox2" runat="server" CssClass="menu-input"></asp:TextBox>

                Aurreik. orduak
                <asp:TextBox ID="TextBox3" runat="server" CssClass="menu-input"></asp:TextBox>

                Benetako orduak
                <asp:TextBox ID="TextBox4" runat="server" CssClass="menu-input"></asp:TextBox>
            </div>

            <asp:Button ID="Button1" runat="server" Text="Lana sortu" CssClass="menu-button" />

            <div class="grid-container">
                <asp:GridView ID="GridView1" runat="server" DataSourceID="sqldsIkasleakLanak" CssClass="grid-view">
                </asp:GridView>
            </div>

            <asp:Label ID="Label1" runat="server" Text="Label" Visible="False"></asp:Label>
            <br />

            <asp:HyperLink ID="HyperLink1" runat="server" CssClass="link-back">Atzera</asp:HyperLink>
        </div>

        <asp:SqlDataSource
            ID="sqldsIkasleakLanak"
            runat="server"
            ConnectionString="<%$ ConnectionStrings:konexioa %>"
            ProviderName="<%$ ConnectionStrings:konexioa.ProviderName %>"
            SelectCommand="SELECT * FROM [IkasleakLanak] WHERE ([email] = @Email)">
            <SelectParameters>
                <asp:ControlParameter Name="Email" ControlID="TextBox1" PropertyName="Text" Type="String" />
            </SelectParameters>
        </asp:SqlDataSource>
    </form>
</body>
</html>