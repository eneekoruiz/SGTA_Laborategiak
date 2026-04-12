Imports loginetaerregistratu

Public Class Menua
    Inherits System.Web.UI.Page

    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load
        Dim email As String = Request.QueryString("erab")
        If Session("erab") Is Nothing Then
            Session.Clear()
            Response.Redirect("Hasiera.aspx")
        Else
            HyperLink1.NavigateUrl = "PasahitzaAldatu.aspx?erab=" & email
            HyperLink2.NavigateUrl = "Amaiera.aspx?erab=" & email
        End If

        Dim emailSesion As String = Session("erab").ToString()

        If email Is Nothing OrElse email <> emailSesion Then
            Session.Clear()
            Response.Redirect("Hasiera.aspx")
            Return
        End If
    End Sub

End Class