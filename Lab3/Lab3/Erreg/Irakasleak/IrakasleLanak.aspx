<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="IrakasleLanak.aspx.vb" Inherits="Lab3.IrakasleLanak" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>Irakasle Lan Generikoak</title>
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
        gap: 20px;
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

    .inputs label {
        font-weight: 500;
    }

    .inputs select, .inputs input[type="text"] {
        padding: 12px 15px;
        font-size: 16px;
        border-radius: 12px;
        border: 1px solid #ccc;
        transition: all 0.2s ease;
    }

    .inputs select:focus, .inputs input:focus {
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
        margin-top: 10px;
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
            <h1>Irakasle Lan Generikoak</h1>
            <p>Hautatu irakasgaia eta kudeatu lanak</p>

            <div class="inputs">
                <label>Irakasgaia hautatu:</label>
                <asp:DropDownList ID="DropDownList1" runat="server" DataSourceID="sqlIrakasleakTaldeak" AutoPostBack="True" DataTextField="irakasgaiKodea" DataValueField="irakasgaiKodea">
                </asp:DropDownList>
            </div>

            <asp:Button ID="Button1" runat="server" Text="Lan berria gehitu" CssClass="menu-button" />

            <div class="grid-container">
                <asp:GridView ID="GridView1" runat="server" DataKeyNames="kodea" DataSourceID="sqlLanGenerikoak" AllowSorting="True" AutoGenerateEditButton="True" CssClass="grid-view">
                </asp:GridView>
            </div>

            <asp:LinkButton ID="LinkButton1" runat="server" CssClass="link-back">Atzera</asp:LinkButton>

            <asp:SqlDataSource
                ID="sqlIrakasleakTaldeak"
                runat="server"
                ConnectionString="<%$ ConnectionStrings:konexioa %>"
                ProviderName="<%$ ConnectionStrings:konexioa.ProviderName %>"
                SelectCommand="SELECT KlasekoTaldeak.irakasgaiKodea FROM (KlasekoTaldeak INNER JOIN IrakasleakTaldeak ON KlasekoTaldeak.kodea = IrakasleakTaldeak.taldeKodea) WHERE (IrakasleakTaldeak.email = @email)">
                <SelectParameters>
                    <asp:SessionParameter Name="email" SessionField="erab" Type="String" />
                </SelectParameters>
            </asp:SqlDataSource>

            <asp:SqlDataSource
                ID="sqlLanGenerikoak"
                runat="server"
                ConnectionString="<%$ ConnectionStrings:konexioa %>"
                SelectCommand="SELECT * FROM [LanGenerikoak] WHERE ([irakasgaiKodea] = @irakasgaiKodea)"
                DeleteCommand="DELETE FROM [LanGenerikoak] WHERE [kodea] = @kodea"
                InsertCommand="INSERT INTO [LanGenerikoak] ([kodea], [deskribapena], [irakasgaiKodea], [aurreikusitakoOrduak], [ustiapenean], [lanMota]) VALUES (@kodea, @deskribapena, @irakasgaiKodea, @aurreikusitakoOrduak, @ustiapenean, @lanMota)"
                UpdateCommand="UPDATE [LanGenerikoak] SET [deskribapena] = @deskribapena, [irakasgaiKodea] = @irakasgaiKodea, [aurreikusitakoOrduak] = @aurreikusitakoOrduak, [ustiapenean] = @ustiapenean, [lanMota] = @lanMota WHERE [kodea] = @kodea">
                <SelectParameters>
                    <asp:ControlParameter Name="irakasgaiKodea" ControlID="DropDownList1" PropertyName="SelectedValue" Type="String" />
                </SelectParameters>
                <InsertParameters>
                    <asp:Parameter Name="kodea" Type="String" />
                    <asp:Parameter Name="deskribapena" Type="String" />
                    <asp:Parameter Name="irakasgaiKodea" Type="String" />
                    <asp:Parameter Name="aurreikusitakoOrduak" Type="Int32" />
                    <asp:Parameter Name="ustiapenean" Type="Boolean" />
                    <asp:Parameter Name="lanMota" Type="String" />
                </InsertParameters>
                <UpdateParameters>
                    <asp:Parameter Name="deskribapena" Type="String" />
                    <asp:Parameter Name="irakasgaiKodea" Type="String" />
                    <asp:Parameter Name="aurreikusitakoOrduak" Type="Int32" />
                    <asp:Parameter Name="ustiapenean" Type="Boolean" />
                    <asp:Parameter Name="lanMota" Type="String" />
                    <asp:Parameter Name="kodea" Type="String" />
                </UpdateParameters>
                <DeleteParameters>
                    <asp:Parameter Name="kodea" Type="String" />
                </DeleteParameters>
            </asp:SqlDataSource>
        </div>
    </form>
</body>
</html>