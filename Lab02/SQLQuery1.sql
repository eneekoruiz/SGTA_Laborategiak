CREATE TABLE [dbo].[Erabiltzaileak] (
    [email]              NVARCHAR (50) NOT NULL,
    [izena]              NVARCHAR (50) NULL,
    [abizena]            NVARCHAR (50) NULL,
    [galderaEzkutua]     NVARCHAR (50) NULL,
    [erantzuna]          NVARCHAR (50) NULL,
    [na]                 INT           NULL,
    [egiaztatzeZenbakia] INT           NULL,
    [egiaztatua]         BIT           NULL,
    [lantaldeKodea]      NVARCHAR (50) NULL,
    [azpitaldeKodea]     NVARCHAR (50) NULL,
    [erabiltzaileMota]   NVARCHAR (50) NULL,
    [pasahitza]          NVARCHAR (16) NULL,
    CONSTRAINT [PK__Erabiltzaileak__0000000000000036] PRIMARY KEY CLUSTERED ([email] ASC)
);

