Public Class ErroreaLortzean
    Inherits ApplicationException
    Public Sub New(Optional ByVal Mezua As String = "Errorea: Ezin izan da erabiltzailea lortu")
        MyBase.New(Mezua)
    End Sub
End Class
