# Migration safety

Preserve the existing production migration history. The known MedOrbits sequence ends at `007_registry_integrity_upgrade.sql`; inspect the repository and use the next unused number for a genuinely required migration. This scaffold intentionally does not create a placeholder `008` migration.
