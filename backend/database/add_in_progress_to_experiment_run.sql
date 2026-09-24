USE promptstudio;

ALTER TABLE Experiment_run
  ADD COLUMN in_progress INT UNSIGNED NOT NULL DEFAULT 0 AFTER attempts;
