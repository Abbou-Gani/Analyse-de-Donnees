"""Ajoute les colonnes manquantes sur une base existante.

Le projet n'utilise pas Alembic : `Base.metadata.create_all` ne crée que les
tables absentes, jamais les colonnes. Ce module rattrape le retard à chaque
démarrage de façon idempotente.
"""

from sqlalchemy import text

from app.core.database import moteur

COLONNES_FICHIERS = {
    "empreinte": "VARCHAR(64)",
    "fichier_precedent_id": "VARCHAR(36) REFERENCES fichiers (id)",
}


def migrer_schema() -> None:
    with moteur.begin() as connexion:
        existantes = {
            ligne[0]
            for ligne in connexion.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'fichiers'"
                )
            )
        }
        for nom, definition in COLONNES_FICHIERS.items():
            if nom in existantes:
                continue
            connexion.execute(
                text(f"ALTER TABLE fichiers ADD COLUMN {nom} {definition}")
            )
        _verifier_lien_versions(connexion)


def _verifier_lien_versions(connexion) -> None:
    """Supprimer un fichier ne doit pas échouer s'il est la version précédente
    d'un autre : la colonne repasse alors à NULL (et la comparaison disparaît)."""
    contrainte = connexion.execute(
        text(
            "SELECT confdeltype FROM pg_constraint "
            "WHERE conname = 'fichiers_fichier_precedent_id_fkey'"
        )
    ).first()
    if contrainte and contrainte[0] == "n":  # déjà ON DELETE SET NULL
        return
    connexion.execute(
        text("ALTER TABLE fichiers DROP CONSTRAINT IF EXISTS fichiers_fichier_precedent_id_fkey")
    )
    connexion.execute(
        text(
            "ALTER TABLE fichiers ADD CONSTRAINT fichiers_fichier_precedent_id_fkey "
            "FOREIGN KEY (fichier_precedent_id) REFERENCES fichiers (id) "
            "ON DELETE SET NULL"
        )
    )
