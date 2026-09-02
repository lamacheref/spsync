# Versioning — M.m.f

> Règles validées le 2026-09-02. Branche de travail `Dev`, releases sur `main`.

## Format

`VERSION` à la racine contient `M.m.f` (semver simplifié) — ex: `0.1.0`. Le fichier est la source de vérité ; `manifest.json` doit le refléter.

## Règles (impératives)

1. **Chaque commit bump `f`** (patch), *même si ce n'est pas un fix*. `f` est un compteur de commits effectifs sur la branche.
   - `0.1.0` → commit → `0.1.1` → commit → `0.1.2`
2. **Ajout de feature bump `m`** (minor) et reset `f` à `0`.
   - Ex: livraison Phase 1 (`F1.x`) : `0.1.12` → `0.2.0`
   - Une feature = au moins une entrée `FEATURES.md` Phase 0-4 cochée + code livré.
3. **Bump `M` (major, breaking) uniquement via PR utilisateur** (pas d'auto-bump). Reset `m` et `f` à `0`.
   - Ex: `0.5.0` → PR "v1.0.0 breaking" → `1.0.0`
   - L'auteur de la PR doit éditer `VERSION` manuellement et justifier le breaking change dans la description PR.

## Workflow Git

```
main  ──o──o──o──▶  (releases, protégée, bump f à chaque merge)
        \  \  \
Dev      o──o──o──▶ (travail quotidien, bump f à chaque commit)
```

- On travaille **toujours** dans `Dev`. `main` ne reçoit que des merges (PR Gitea `Dev → main`) ou le premier commit d'init.
- `master` n'existe pas — `main` est la branche par défaut (Gitea `default_branch: main` via API).
- Chaque commit sur `Dev` (ou merge vers `main`) **doit** incrémenter `VERSION` et `manifest.json:version` si présent.

## Outils

### Scripts

- `scripts/bump.sh [major|minor|patch]` — incrémente `VERSION` selon la règle. Sans arg, fait `patch` (défaut `f`).
  ```bash
  ./scripts/bump.sh        # 0.1.0 → 0.1.1
  ./scripts/bump.sh minor  # 0.1.12 → 0.2.0
  ./scripts/bump.sh major  # 0.5.3 → 1.0.0  (réservé PR utilisateur)
  ```
- Le script met à jour `VERSION` et `manifest.json` si existant, puis `git add` les fichiers.

### Hook pre-commit (optionnel mais recommandé)

`.git/hooks/pre-commit` vérifie que `VERSION` a été bumpé par rapport à `HEAD` (ou `origin/Dev`). Si non, il refuse le commit avec message explicite.

Activer :
```bash
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### CI Gitea (`.gitea/workflows/version.yml`)

- Vérifie à chaque push sur `Dev` que `VERSION` a changé vs `origin/main`.
- Vérifie que `manifest.json:version == VERSION`.
- Bloque le merge `Dev → main` si `M` a changé sans label `major` (protection PR).

## Exemple d'historique

```
0.1.0  init main (PROJET.md, plugin scaffolding vide)
0.1.1  docs: typo
0.1.2  feat: configFields Zammad
0.2.0  minor: Phase 1 lecture Zammad livrée
0.2.1  fix: timeout 30s
1.0.0  major: PR utilisateur "v1 stable" (breaking: rename id)
```

## Checklist commit

- [ ] `VERSION` bumpé (`f` ou `m` selon nature)
- [ ] `manifest.json:version` synchro
- [ ] `CHANGELOG.md` entrée ajoutée (optionnel en Dev, obligatoire en main)
