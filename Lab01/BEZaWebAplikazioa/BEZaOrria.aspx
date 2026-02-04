<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="BEZaOrria.aspx.vb" Inherits="BEZaWebAplikazioa.BEZaOrria" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Lab01</title>
</head>
<body>
    <form id="form1" runat="server">
        <div>

            &nbsp;Ordaindu beharrekoa<input id="Text1" type="text" /></div>
    <p>
        <input id="Radio1" name="R" type="radio" value="V1" checked="true" />Orokorra</p>
    <p>
        <input id="Radio2" name="R" type="radio" value="V2" />Murriztua</p>
    <p>
        <input id="Radio3" name="R" type="radio" value="V3" />Oinarrizkoa</p>
    <p>
        <input id="Button1" type="button" value="KALKULATU" /><asp:Button ID="Button2" runat="server" Text="Button" />
        </p>
        <p>
            Bezik gabe =
            <asp:Label ID="Label1" runat="server" Text="Label"></asp:Label>
        </p>
        <p>
            Bezarekin =
            <asp:Label ID="Label2" runat="server" Text="Label"></asp:Label>
        </p>
    </form>
    </body>
</html>