Imports System.Data.SqlClient
Imports loginetaerregistratu

Public Class LanaInstantziatu
    Inherits System.Web.UI.Page

    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load
        If Not IsPostBack Then
            TextBox1.Text = Session("erab").ToString()
            TextBox2.Text = Request.QueryString("lan").ToString()

            Dim adapter As SqlDataAdapter = DatuAtzipena.IkasleLanEgokitzaileaEskuratu(Session("erab").ToString())
            Dim ds As New DataSet()
            adapter.Fill(ds, "ikasleakLanak")

            Session("adapter") = adapter
            Session("dataSet") = ds

            HyperLink1.NavigateUrl = "~/Erreg/Ikasleak/IkasleLanGenerikoak.aspx?erab=" & Session("erab").ToString()



        End If
        Dim email As String = Request.QueryString("erab")
        If Session("erab") Is Nothing Then
            Session.Abandon()
            Response.Redirect("~/Hasiera.aspx")
        End If

        Dim emailSesion As String = Session("erab").ToString()

        If email Is Nothing OrElse email <> emailSesion Then
            Session.Abandon()
            Response.Redirect("~/Hasiera.aspx")
            Return
        End If


    End Sub

    Protected Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        Label1.Visible = True
        Label1.Text = ""

        Dim ds As DataSet = CType(Session("dataset"), DataSet)
            Dim adapter As SqlDataAdapter = CType(Session("adapter"), SqlDataAdapter)

            Dim taula As DataTable = ds.Tables("IkasleakLanak")

            Dim vista As New DataView(taula)
            vista.RowFilter = "lanGenerikoarenKodea = '" & TextBox2.Text & "'"

        If vista.Count = 0 Then

            Dim lerroBerr As DataRow = taula.NewRow()
            lerroBerr("email") = TextBox1.Text
            lerroBerr("lanGenerikoarenKodea") = TextBox2.Text
            lerroBerr("aurreikusitakoOrduak") = TextBox3.Text
            lerroBerr("benetakoOrduak") = TextBox4.Text

            taula.Rows.Add(lerroBerr)

            Dim builder As New SqlCommandBuilder(adapter)
            adapter.Update(ds, "IkasleakLanak")

            sqldsIkasleakLanak.DataBind()
            GridView1.DataBind()

            Label1.Text = "Ongi instantziatu da lana"
        Else
            Label1.Text = "Errorea: Lana instantziatu hau jadanik existitzen da."
        End If


    End Sub
End Class