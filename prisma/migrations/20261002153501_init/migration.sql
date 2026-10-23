-- CreateTable
CREATE TABLE `Experiment` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `datetime` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `total_requests` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `max_retry` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `threads` INTEGER UNSIGNED NOT NULL DEFAULT 1,

    UNIQUE INDEX `Experiment_title_key`(`title`),
    INDEX `idx_experiment_title`(`title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Node` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `type` ENUM('prompt_template', 'processor', 'evaluator', 'dataset') NOT NULL,
    `experiment_id` INTEGER UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `unique_node_name`(`experiment_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Link` (
    `source_node_id` INTEGER UNSIGNED NOT NULL,
    `target_node_id` INTEGER UNSIGNED NOT NULL,
    `source_var` VARCHAR(255) NULL,
    `target_var` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`source_node_id`, `target_node_id`, `target_var`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Llm` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `base_model` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `model` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `Llm_base_model_key`(`base_model`),
    INDEX `idx_llm_base_model`(`base_model`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Llm_param` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `temperature` DOUBLE NULL,
    `max_tokens` INTEGER UNSIGNED NULL,
    `top_p` DOUBLE NULL,
    `top_k` INTEGER UNSIGNED NULL,
    `stop_sequence` TEXT NULL,
    `frequency_penalty` DOUBLE NULL,
    `presence_penalty` DOUBLE NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Llm_custom_param` (
    `name` VARCHAR(255) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `llm_param_id` INTEGER UNSIGNED NOT NULL,

    PRIMARY KEY (`name`, `llm_param_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptTemplate` (
    `node_id` INTEGER UNSIGNED NOT NULL,
    `value` TEXT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `iterations` INTEGER NOT NULL DEFAULT 1,

    INDEX `idx_prompt_template_name`(`name`),
    PRIMARY KEY (`node_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dataset` (
    `node_id` INTEGER UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,

    INDEX `idx_dataset_name`(`name`),
    PRIMARY KEY (`node_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Marker` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `marker` VARCHAR(255) NOT NULL,
    `dataset_id` INTEGER UNSIGNED NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Marker_value` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `marker_id` INTEGER UNSIGNED NOT NULL,
    `value` TEXT NOT NULL,
    `hash` CHAR(64) NOT NULL,

    UNIQUE INDEX `Marker_value_hash_key`(`hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evaluator` (
    `nodeId` INTEGER UNSIGNED NOT NULL,
    `type` ENUM('simple', 'javascript', 'python', 'llm', 'multieval') NOT NULL,
    `code` MEDIUMTEXT NULL,
    `name` VARCHAR(255) NOT NULL,
    `return_type` ENUM('string', 'number', 'boolean') NOT NULL DEFAULT 'string',

    PRIMARY KEY (`nodeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Llm_evaluator` (
    `node_id` INTEGER UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `llm_param_id` INTEGER UNSIGNED NOT NULL,
    `llm_id` INTEGER UNSIGNED NOT NULL,
    `format` TEXT NOT NULL,
    `prompt` TEXT NOT NULL,
    `reason_before_scoring` BOOLEAN NOT NULL,

    PRIMARY KEY (`node_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Multi_evaluator` (
    `evaluator_id` INTEGER UNSIGNED NOT NULL,
    `child_evaluator_id` INTEGER UNSIGNED NOT NULL,

    PRIMARY KEY (`evaluator_id`, `child_evaluator_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Simple_evaluator` (
    `node_id` INTEGER UNSIGNED NOT NULL,
    `text_value` TEXT NOT NULL,
    `var_value` TEXT NULL,
    `var_type` TEXT NULL,
    `var_selected` BOOLEAN NULL,

    PRIMARY KEY (`node_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptConfig` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `experiment_id` INTEGER UNSIGNED NOT NULL,
    `LLM_id` INTEGER UNSIGNED NOT NULL,
    `LLM_param_id` INTEGER UNSIGNED NOT NULL,
    `prompt_template_id` INTEGER UNSIGNED NOT NULL,
    `final_dataset_id` INTEGER UNSIGNED NULL,

    UNIQUE INDEX `unique_experiment_llm_llm_param_prompt`(`experiment_id`, `LLM_id`, `LLM_param_id`, `prompt_template_id`, `final_dataset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Data_Input` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `dataset_id` INTEGER UNSIGNED NOT NULL,
    `oracle` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Resolved_input` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `source_input_id` INTEGER UNSIGNED NOT NULL,
    `value` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Input_marker` (
    `input_id` INTEGER UNSIGNED NOT NULL,
    `marker_values_id` INTEGER UNSIGNED NOT NULL,

    PRIMARY KEY (`input_id`, `marker_values_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Result` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `run_id` VARCHAR(36) NULL,
    `config_id` INTEGER UNSIGNED NOT NULL,
    `output_result` TEXT NOT NULL,
    `input_id` INTEGER UNSIGNED NOT NULL,
    `start_time` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `end_time` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `total_tokens` INTEGER UNSIGNED NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Error` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `config_id` INTEGER UNSIGNED NOT NULL,
    `input_id` INTEGER UNSIGNED NOT NULL,
    `error_message` TEXT NOT NULL,
    `error_code` INTEGER UNSIGNED NOT NULL,
    `start_time` TIMESTAMP(6) NOT NULL,
    `end_time` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Processor` (
    `node_id` INTEGER UNSIGNED NOT NULL,
    `type` ENUM('join', 'split', 'javascript', 'python') NOT NULL,
    `code` MEDIUMTEXT NULL,
    `format` TEXT NULL,
    `selected_group_vars` TEXT NULL,
    `name` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`node_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Error_evaluator` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `evaluator_id` INTEGER UNSIGNED NOT NULL,
    `error_message` TEXT NOT NULL,
    `result_id` INTEGER UNSIGNED NULL,
    `input_id` INTEGER UNSIGNED NULL,
    `timestamp` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvaluationsResult` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `evaluation_result` TEXT NOT NULL,
    `result_id` INTEGER UNSIGNED NULL,
    `input_id` INTEGER UNSIGNED NULL,
    `evaluator_id` INTEGER UNSIGNED NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcessorResult` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `processor_result` TEXT NOT NULL,
    `result_id` INTEGER UNSIGNED NULL,
    `resolved_input_id` INTEGER UNSIGNED NULL,
    `processor_id` INTEGER UNSIGNED NOT NULL,
    `input_id` INTEGER UNSIGNED NULL,

    UNIQUE INDEX `Unique_Processor_Result`(`result_id`, `processor_id`),
    UNIQUE INDEX `Unique_Processor_Resolved_Input`(`processor_id`, `resolved_input_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Processor_error` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `processor_id` INTEGER UNSIGNED NOT NULL,
    `error_message` TEXT NOT NULL,
    `result_id` INTEGER UNSIGNED NULL,
    `input_id` INTEGER UNSIGNED NULL,
    `resolved_input_id` INTEGER UNSIGNED NULL,
    `timestamp` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Experiment_run` (
    `run_id` CHAR(36) NOT NULL,
    `experiment_id` INTEGER UNSIGNED NOT NULL,
    `experiment_name` VARCHAR(255) NOT NULL,
    `status` ENUM('queued', 'running', 'paused', 'completed', 'failed') NOT NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `started_at` TIMESTAMP(6) NULL,
    `paused_at` TIMESTAMP(6) NULL,
    `finished_at` TIMESTAMP(6) NULL,
    `updated_at` TIMESTAMP(6) NOT NULL,
    `total_paused_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `total_tasks` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `attempts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `in_progress` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `completed` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `failed` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `retries` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `total_tokens` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `last_error` TEXT NULL,
    `total_latency_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `latency_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `min_latency_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `p25_latency_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `p50_latency_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `p75_latency_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `p95_latency_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `p99_latency_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `max_latency_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `samples` JSON NULL,

    PRIMARY KEY (`run_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Node` ADD CONSTRAINT `FK_experiment_id_node` FOREIGN KEY (`experiment_id`) REFERENCES `Experiment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Link` ADD CONSTRAINT `FK_source_node_id` FOREIGN KEY (`source_node_id`) REFERENCES `Node`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Link` ADD CONSTRAINT `FK_target_node_id` FOREIGN KEY (`target_node_id`) REFERENCES `Node`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Llm_custom_param` ADD CONSTRAINT `FK_llm_param` FOREIGN KEY (`llm_param_id`) REFERENCES `Llm_param`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptTemplate` ADD CONSTRAINT `FK_node_id_prompt_template` FOREIGN KEY (`node_id`) REFERENCES `Node`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dataset` ADD CONSTRAINT `FK_node_id_dataset` FOREIGN KEY (`node_id`) REFERENCES `Node`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Marker` ADD CONSTRAINT `FK_dataset_id_marker` FOREIGN KEY (`dataset_id`) REFERENCES `Dataset`(`node_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Marker_value` ADD CONSTRAINT `FK_marker_id` FOREIGN KEY (`marker_id`) REFERENCES `Marker`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evaluator` ADD CONSTRAINT `FK_node_id_evaluator` FOREIGN KEY (`nodeId`) REFERENCES `Node`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Llm_evaluator` ADD CONSTRAINT `FK_llm_evaluator_node_id` FOREIGN KEY (`node_id`) REFERENCES `Evaluator`(`nodeId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Llm_evaluator` ADD CONSTRAINT `FK_llm_evaluator_param_id` FOREIGN KEY (`llm_param_id`) REFERENCES `Llm_param`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Llm_evaluator` ADD CONSTRAINT `FK_llm_evaluator_llm_id` FOREIGN KEY (`llm_id`) REFERENCES `Llm`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Multi_evaluator` ADD CONSTRAINT `FK_multi_evaluator_id` FOREIGN KEY (`evaluator_id`) REFERENCES `Evaluator`(`nodeId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Multi_evaluator` ADD CONSTRAINT `FK_child_evaluator_id` FOREIGN KEY (`child_evaluator_id`) REFERENCES `Evaluator`(`nodeId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Simple_evaluator` ADD CONSTRAINT `FK_simple_evaluator_node_id` FOREIGN KEY (`node_id`) REFERENCES `Evaluator`(`nodeId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptConfig` ADD CONSTRAINT `FK_experiment_id` FOREIGN KEY (`experiment_id`) REFERENCES `Experiment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptConfig` ADD CONSTRAINT `FK_LLM_id` FOREIGN KEY (`LLM_id`) REFERENCES `Llm`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptConfig` ADD CONSTRAINT `FK_LLM_param_id` FOREIGN KEY (`LLM_param_id`) REFERENCES `Llm_param`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptConfig` ADD CONSTRAINT `FK_Prompt_template_id` FOREIGN KEY (`prompt_template_id`) REFERENCES `PromptTemplate`(`node_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptConfig` ADD CONSTRAINT `FK_dataset_id` FOREIGN KEY (`final_dataset_id`) REFERENCES `Dataset`(`node_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Data_Input` ADD CONSTRAINT `FK_dataset_id_input` FOREIGN KEY (`dataset_id`) REFERENCES `Dataset`(`node_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resolved_input` ADD CONSTRAINT `PK_input_id_resolved_input` FOREIGN KEY (`source_input_id`) REFERENCES `Data_Input`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Input_marker` ADD CONSTRAINT `FK_input_id` FOREIGN KEY (`input_id`) REFERENCES `Data_Input`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Input_marker` ADD CONSTRAINT `FK_marker_id_input` FOREIGN KEY (`marker_values_id`) REFERENCES `Marker_value`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Result` ADD CONSTRAINT `FK_config_id` FOREIGN KEY (`config_id`) REFERENCES `PromptConfig`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Result` ADD CONSTRAINT `FK_input_id_result` FOREIGN KEY (`input_id`) REFERENCES `Data_Input`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Error` ADD CONSTRAINT `FK_config_id_error` FOREIGN KEY (`config_id`) REFERENCES `PromptConfig`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Error` ADD CONSTRAINT `FK_input_id_error` FOREIGN KEY (`input_id`) REFERENCES `Data_Input`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Processor` ADD CONSTRAINT `FK_node_id_processor` FOREIGN KEY (`node_id`) REFERENCES `Node`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Error_evaluator` ADD CONSTRAINT `FK_evaluator_id_error_eval` FOREIGN KEY (`evaluator_id`) REFERENCES `Evaluator`(`nodeId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Error_evaluator` ADD CONSTRAINT `FK_result_id_error_eval` FOREIGN KEY (`result_id`) REFERENCES `Result`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Error_evaluator` ADD CONSTRAINT `FK_input_id_evaluator_error` FOREIGN KEY (`input_id`) REFERENCES `Data_Input`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationsResult` ADD CONSTRAINT `FK_result_id_eval` FOREIGN KEY (`result_id`) REFERENCES `Result`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationsResult` ADD CONSTRAINT `FK_input_id_evaluator` FOREIGN KEY (`input_id`) REFERENCES `Data_Input`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationsResult` ADD CONSTRAINT `FK_evaluator_id` FOREIGN KEY (`evaluator_id`) REFERENCES `Evaluator`(`nodeId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessorResult` ADD CONSTRAINT `FK_result_id_processor` FOREIGN KEY (`result_id`) REFERENCES `Result`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessorResult` ADD CONSTRAINT `FK_resolved_input_id_processor` FOREIGN KEY (`resolved_input_id`) REFERENCES `Resolved_input`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessorResult` ADD CONSTRAINT `FK_processor_id` FOREIGN KEY (`processor_id`) REFERENCES `Processor`(`node_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessorResult` ADD CONSTRAINT `FK_input_id_processor` FOREIGN KEY (`input_id`) REFERENCES `Data_Input`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Processor_error` ADD CONSTRAINT `FK_resolved_input_id_processor_error` FOREIGN KEY (`resolved_input_id`) REFERENCES `Resolved_input`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Processor_error` ADD CONSTRAINT `FK_processor_id_error` FOREIGN KEY (`processor_id`) REFERENCES `Processor`(`node_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Processor_error` ADD CONSTRAINT `FK_result_id_processor_error` FOREIGN KEY (`result_id`) REFERENCES `Result`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Processor_error` ADD CONSTRAINT `FK_input_id_processor_error` FOREIGN KEY (`input_id`) REFERENCES `Data_Input`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Experiment_run` ADD CONSTRAINT `FK_experiment_id_run` FOREIGN KEY (`experiment_id`) REFERENCES `Experiment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
