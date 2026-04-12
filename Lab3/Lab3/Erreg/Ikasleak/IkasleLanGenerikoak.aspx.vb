Imports System.Data.SqlClient
Imports loginetaerregistratu

Public Class IkasleLanGenerikoak
    Inherits System.Web.UI.Page

    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load
        Dim email As String = Request.QueryString("erab")
        If Not IsPostBack Then
            Dim adapter As SqlDataAdapter = DatuAtzipena.IkasleaMatrikulatutakoIrakasgaienEgokitzaileaEskuratu(email)
            Dim table As New DataTable()
            adapter.Fill(table)
            DropDownList1.DataSource = table
            DropDownList1.DataTextField = "irakasgaiKodea"
            DropDownList1.DataValueField = "irakasgaiKodea"
            DropDownList1.DataBind()
            Dim da As SqlDataAdapter = DatuAtzipena.UstiapenekoLanGenerikoenEgokitzaileaEskuratu(email)
            Dim dataset As New DataSet()
            da.Fill(dataset)
            Session("LanGenerikoak") = dataset

            Dim liKodea As New ListItem("Kodea", "kodea")
            liKodea.Selected = True
            liKodea.Enabled = False
            CheckBoxList1.Items.Add(liKodea)

            CheckBoxList1.Items.Add(New ListItem("Deskribapena", "deskribapena"))
            CheckBoxList1.Items.Add(New ListItem("Aurreik. orduak", "aurreikusitakoOrduak"))
            CheckBoxList1.Items.Add(New ListItem("Lan mota", "lanMota"))
        End If
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
        Dim ds As DataSet = CType(Session("LanGenerikoak"), DataSet)
        Dim dv As New DataView(ds.Tables(0))
        dv.RowFilter = "irakasgaiKodea = '" & DropDownList1.SelectedValue & "'"
        GridView1.DataSource = dv

        GridView1.DataBind()

        GridView1.Columns(1).Visible = True
        GridView1.Columns(2).Visible = False
        GridView1.Columns(3).Visible = False
        GridView1.Columns(4).Visible = False

        For Each item As ListItem In CheckBoxList1.Items
            If item.Selected Then
                Select Case item.Value
                    Case "deskribapena"
                        GridView1.Columns(2).Visible = True
                    Case "aurreikusitakoOrduak"
                        GridView1.Columns(3).Visible = True
                    Case "lanMota"
                        GridView1.Columns(4).Visible = True
                End Select
            End If
        Next

        GridView1.Visible = True

    End Sub

    Protected Sub GridView1_SelectedIndexChanged(sender As Object, e As EventArgs) Handles GridView1.SelectedIndexChanged
        Dim lanKodea As String = GridView1.SelectedDataKey.Value.ToString()
        Response.Redirect("~/Erreg/Ikasleak/LanaInstantziatu.aspx?erab=" & Request.QueryString("erab") & "&lan=" & lanKodea)
    End Sub

    Protected Sub GridView1_Sorting(sender As Object, e As GridViewSortEventArgs) Handles GridView1.Sorting
        Dim ds As DataSet = CType(Session("LanGenerikoak"), DataSet)
        Dim dv As New DataView(ds.Tables(0))
        dv.RowFilter = "irakasgaiKodea = '" & DropDownList1.SelectedValue & "'"
        dv.Sort = e.SortExpression & " ASC"
        GridView1.DataSource = dv
        GridView1.DataBind()
    End Sub

End Class