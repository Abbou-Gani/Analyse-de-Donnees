from app.services.analyse_excel import analyser_excel
from app.services.analyse_word import analyser_word


def analyser_fichier(contenu: bytes, type_fichier: str) -> dict:
    if type_fichier == "xlsx":
        return analyser_excel(contenu)
    if type_fichier == "docx":
        return analyser_word(contenu)
    raise ValueError(f"Type de fichier non pris en charge : {type_fichier}")
