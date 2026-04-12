Imports System.Data.SqlClient
Imports loginetaerregistratu

Public Class LanGenerikoaGehitu
    Inherits System.Web.UI.Page

    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load
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
        Dim da As SqlDataAdapter = DatuAtzipena.LanGenerikoEgokitzaileaEskuratu()
        Dim ds As New DataSet()
        da.Fill(ds, "LanGenerikoEgokitzailea")
        Session("ds") = ds
        Session("da") = da
        HyperLink1.NavigateUrl = "~/Erreg/Irakasleak/IrakasleLanak.aspx?erab=" & Request.QueryString("erab")
    End Sub

    Protected Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        Try
            Label1.Text = ""
            Label1.Visible = True
            Dim ds As DataSet = CType(Session("ds"), DataSet)
            Dim da As SqlDataAdapter = CType(Session("da"), SqlDataAdapter)

            Dim taula As DataTable = ds.Tables(0)

            Dim lerroBerr As DataRow = taula.NewRow()

            lerroBerr("kodea") = TextBox1.Text
            lerroBerr("deskribapena") = TextBox2.Text
            lerroBerr("irakasgaiKodea") = DropDownList2.SelectedValue
            lerroBerr("aurreikusitakoOrduak") = TextBox3.Text
            lerroBerr("ustiapenean") = False
            lerroBerr("lanMota") = DropDownList1.SelectedValue

            taula.Rows.Add(lerroBerr)

            Dim builder As New SqlCommandBuilder(da)

            da.Update(ds, taula.TableName)
            Label1.Text = "Lan generikoa ongi gehitu da."
        Catch ex As Exception

            Label1.Text = "Errorea gertatu da lan generikoa gehitzean: " & ex.Message
            Return
        End Try
    End Sub
End Class