Public Class ErroreaGehitzean
    Inherits ApplicationException
    Public Sub New(Optional ByVal Mezua As String = "Errorea: Ezin izan da erabiltzailea gehitu")
        MyBase.New(Mezua)
    End Sub
End Class
