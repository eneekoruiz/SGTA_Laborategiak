Imports Lab01

Public Class Form1
    Private Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        Dim texto = TextBox1.Text.Trim()
        Dim ordTotal As Double
        Try
            ordTotal = Convert.ToDouble(texto)
        Catch ex As Exception
            MessageBox.Show("Sartu zenbaki bat mesedez.")
            Return
        End Try

        Dim bez As BEZKalkulu.bezMotak
        If RadioButton1.Checked Then
            bez = BEZKalkulu.bezMotak.Orokorra
        ElseIf RadioButton2.Checked Then
            bez = BEZKalkulu.bezMotak.Murriztua
        Else
            bez = BEZKalkulu.bezMotak.Oinarrizkoa
        End If

        Dim kalkulu As New BEZKalkulu(ordTotal, bez)
        Dim totalaBezGabe = kalkulu.totalaBEZGabe()
        Dim ordBez = kalkulu.ordBEZ()

        TextBox2.Text = ordBez.ToString("F2")
        TextBox3.Text = totalaBezGabe.ToString("F2")
    End Sub


End Class
