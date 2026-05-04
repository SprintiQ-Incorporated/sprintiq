-- Enhance roles table to support detailed role information
-- Add new columns to support rich role data similar to persona system

-- Add new columns to roles table
ALTER TABLE roles ADD COLUMN IF NOT EXISTS experience VARCHAR(100);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS core_competencies JSONB;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS template_data JSONB;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Create index on category for better performance
CREATE INDEX IF NOT EXISTS idx_roles_category ON roles(category);

-- Create index on is_template for filtering
CREATE INDEX IF NOT EXISTS idx_roles_is_template ON roles(is_template);

-- Create indexes for user and workspace filtering
CREATE INDEX IF NOT EXISTS idx_roles_created_by ON roles(created_by);
CREATE INDEX IF NOT EXISTS idx_roles_workspace_id ON roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_roles_user_workspace ON roles(created_by, workspace_id);

-- Update existing roles to have default category
UPDATE roles SET category = 'General' WHERE category IS NULL;

-- Add some enhanced role templates
INSERT INTO roles (name, description, experience, category, is_template, core_competencies, template_data) VALUES
(
  'AI/ML Engineer',
  'Designs, builds, and deploys machine learning models and AI systems to solve complex business problems. Transforms raw data into intelligent solutions through statistical analysis, algorithm development, and scalable model deployment.',
  '3+ years',
  'Engineering',
  true,
  '{
    "machine_learning": [
      "supervised_learning",
      "unsupervised_learning", 
      "deep_learning",
      "neural_networks",
      "computer_vision",
      "nlp",
      "reinforcement_learning",
      "model_optimization",
      "feature_engineering"
    ],
    "frameworks_tools": [
      "tensorflow",
      "pytorch", 
      "scikit_learn",
      "keras",
      "huggingface",
      "opencv",
      "pandas",
      "numpy",
      "matplotlib",
      "jupyter"
    ],
    "programming": [
      "python",
      "r",
      "sql",
      "bash",
      "git",
      "docker",
      "kubernetes",
      "aws",
      "gcp",
      "azure"
    ],
    "deployment": [
      "mlops",
      "model_serving",
      "api_development",
      "cloud_platforms",
      "monitoring",
      "a_b_testing",
      "ci_cd",
      "containerization"
    ]
  }'::jsonb,
  '{
    "icon": "brain",
    "color": "purple",
    "tags": ["ai", "ml", "data", "engineering"],
    "difficulty": "advanced"
  }'::jsonb
),
(
  'Cloud Engineer',
  'Designs, implements, and manages scalable cloud infrastructure and services. Ensures high availability, security, and cost optimization while enabling seamless deployment and operation of applications in cloud environments.',
  '3+ years',
  'Engineering',
  true,
  '{
    "cloud_platforms": [
      "aws",
      "azure",
      "gcp",
      "alibaba_cloud",
      "oracle_cloud",
      "multi_cloud",
      "hybrid_cloud"
    ],
    "infrastructure_as_code": [
      "terraform",
      "cloudformation",
      "arm_templates",
      "pulumi",
      "ansible",
      "chef",
      "puppet"
    ],
    "containerization": [
      "docker",
      "kubernetes",
      "openshift",
      "ecs",
      "aks",
      "gke",
      "helm",
      "istio"
    ],
    "devops_automation": [
      "ci_cd",
      "jenkins",
      "gitlab_ci",
      "github_actions",
      "azure_devops",
      "monitoring",
      "logging",
      "alerting"
    ],
    "security_compliance": [
      "iam",
      "vpc",
      "security_groups",
      "ssl_tls",
      "encryption",
      "compliance",
      "vulnerability_scanning"
    ],
    "programming_scripting": [
      "python",
      "bash",
      "powershell",
      "yaml",
      "json",
      "go",
      "nodejs"
    ]
  }'::jsonb,
  '{
    "icon": "cloud",
    "color": "blue",
    "tags": ["cloud", "infrastructure", "devops"],
    "difficulty": "advanced"
  }'::jsonb
),
(
  'Data Engineer',
  'Builds and maintains robust data pipelines and infrastructure that enable efficient collection, processing, and storage of large-scale data. Ensures data quality, accessibility, and reliability for analytics and machine learning workflows.',
  '3+ years',
  'Engineering',
  true,
  '{
    "data_pipelines": [
      "etl",
      "elt",
      "data_streaming",
      "batch_processing",
      "real_time_processing",
      "data_orchestration",
      "workflow_automation"
    ],
    "big_data_tools": [
      "apache_spark",
      "hadoop",
      "kafka",
      "airflow",
      "databricks",
      "snowflake",
      "redshift",
      "bigquery"
    ],
    "databases": [
      "postgresql",
      "mysql",
      "mongodb",
      "cassandra",
      "elasticsearch",
      "redis",
      "dynamodb",
      "cosmos_db"
    ],
    "programming": [
      "python",
      "sql",
      "scala",
      "java",
      "bash",
      "r",
      "pyspark",
      "pandas",
      "numpy"
    ],
    "cloud_platforms": [
      "aws",
      "azure",
      "gcp",
      "s3",
      "azure_data_factory",
      "cloud_dataflow",
      "lambda",
      "azure_functions"
    ],
    "data_modeling": [
      "dimensional_modeling",
      "data_warehousing",
      "data_lakes",
      "schema_design",
      "normalization",
      "star_schema",
      "snowflake_schema"
    ]
  }'::jsonb,
  '{
    "icon": "database",
    "color": "green",
    "tags": ["data", "engineering", "pipelines"],
    "difficulty": "advanced"
  }'::jsonb
),
(
  'Analytics Product Manager',
  'Drives product strategy and development for analytics platforms and data products. Translates business requirements into technical specifications while collaborating with engineering, data science, and stakeholder teams to deliver impactful data solutions.',
  '3+ years',
  'Product',
  true,
  '{
    "product_management": [
      "product_strategy",
      "roadmap_planning",
      "user_research",
      "requirements_gathering",
      "stakeholder_management",
      "agile_scrum",
      "product_analytics",
      "a_b_testing"
    ],
    "analytics_tools": [
      "tableau",
      "power_bi",
      "looker",
      "qlik",
      "google_analytics",
      "adobe_analytics",
      "mixpanel",
      "amplitude",
      "segment"
    ],
    "data_analysis": [
      "sql",
      "python",
      "r",
      "excel",
      "statistical_analysis",
      "data_visualization",
      "cohort_analysis",
      "funnel_analysis",
      "retention_metrics"
    ],
    "technical_understanding": [
      "data_warehousing",
      "etl_processes",
      "apis",
      "data_modeling",
      "cloud_platforms",
      "database_concepts",
      "machine_learning_basics"
    ],
    "business_skills": [
      "market_research",
      "competitive_analysis",
      "roi_analysis",
      "kpi_definition",
      "business_intelligence",
      "cross_functional_collaboration",
      "presentation_skills",
      "project_management"
    ],
    "communication": [
      "technical_writing",
      "data_storytelling",
      "executive_reporting",
      "user_documentation",
      "training_delivery",
      "change_management"
    ]
  }'::jsonb,
  '{
    "icon": "chart-line",
    "color": "orange",
    "tags": ["product", "analytics", "management"],
    "difficulty": "intermediate"
  }'::jsonb
),
(
  'Security Engineer',
  'Designs, implements, and maintains security systems and protocols to protect organizational infrastructure, applications, and data. Identifies vulnerabilities, responds to security incidents, and ensures compliance with security standards and regulations.',
  '3+ years',
  'Engineering',
  true,
  '{
    "security_fundamentals": [
      "threat_modeling",
      "risk_assessment",
      "vulnerability_management",
      "penetration_testing",
      "security_architecture",
      "cryptography",
      "secure_coding",
      "security_auditing"
    ],
    "cloud_security": [
      "aws_security",
      "azure_security",
      "gcp_security",
      "iam",
      "vpc_security",
      "cloud_compliance",
      "container_security",
      "serverless_security"
    ],
    "network_security": [
      "firewalls",
      "intrusion_detection",
      "intrusion_prevention",
      "vpn",
      "network_segmentation",
      "dns_security",
      "ddos_protection",
      "network_monitoring"
    ],
    "application_security": [
      "secure_sdlc",
      "code_review",
      "static_analysis",
      "dynamic_analysis",
      "api_security",
      "web_security",
      "mobile_security",
      "dependency_scanning"
    ],
    "security_tools": [
      "splunk",
      "elk_stack",
      "nessus",
      "burp_suite",
      "metasploit",
      "wireshark",
      "nmap",
      "qualys",
      "crowdstrike",
      "okta"
    ],
    "compliance_governance": [
      "iso_27001",
      "soc_2",
      "gdpr",
      "hipaa",
      "pci_dss",
      "nist",
      "cis_controls",
      "policy_development",
      "audit_preparation"
    ],
    "incident_response": [
      "threat_hunting",
      "forensics",
      "incident_analysis",
      "malware_analysis",
      "security_monitoring",
      "siem",
      "soar",
      "playbook_development"
    ],
    "programming_scripting": [
      "python",
      "bash",
      "powershell",
      "javascript",
      "sql",
      "regex",
      "automation",
      "api_integration"
    ]
  }'::jsonb,
  '{
    "icon": "shield",
    "color": "red",
    "tags": ["security", "engineering", "compliance"],
    "difficulty": "advanced"
  }'::jsonb
),
(
  'Platform Engineer',
  'Builds and maintains internal developer platforms and infrastructure that enable teams to deploy, operate, and scale applications efficiently. Creates self-service tools and automated workflows that improve developer productivity and system reliability.',
  '3+ years',
  'Engineering',
  true,
  '{
    "infrastructure_as_code": [
      "terraform",
      "pulumi",
      "cloudformation",
      "arm_templates",
      "ansible",
      "chef",
      "puppet",
      "helm_charts"
    ],
    "container_orchestration": [
      "kubernetes",
      "docker",
      "openshift",
      "ecs",
      "aks",
      "gke",
      "helm",
      "kustomize",
      "istio",
      "linkerd"
    ],
    "cloud_platforms": [
      "aws",
      "azure",
      "gcp",
      "multi_cloud",
      "hybrid_cloud",
      "edge_computing",
      "serverless",
      "cloud_native"
    ],
    "ci_cd_automation": [
      "jenkins",
      "gitlab_ci",
      "github_actions",
      "azure_devops",
      "tekton",
      "argo_cd",
      "flux",
      "pipeline_orchestration"
    ],
    "monitoring_observability": [
      "prometheus",
      "grafana",
      "elk_stack",
      "splunk",
      "datadog",
      "new_relic",
      "jaeger",
      "zipkin",
      "opentelemetry"
    ],
    "developer_experience": [
      "internal_platforms",
      "developer_portals",
      "self_service_tools",
      "documentation",
      "onboarding_automation",
      "cli_tools",
      "api_gateways"
    ],
    "programming_scripting": [
      "python",
      "go",
      "bash",
      "powershell",
      "yaml",
      "json",
      "nodejs",
      "rust"
    ],
    "databases_storage": [
      "postgresql",
      "mysql",
      "mongodb",
      "redis",
      "elasticsearch",
      "s3",
      "blob_storage",
      "backup_strategies"
    ],
    "networking_security": [
      "vpc",
      "load_balancers",
      "cdn",
      "dns",
      "ssl_tls",
      "iam",
      "rbac",
      "network_policies",
      "security_scanning"
    ],
    "service_mesh": [
      "istio",
      "linkerd",
      "consul_connect",
      "envoy",
      "traffic_management",
      "service_discovery",
      "circuit_breakers"
    ]
  }'::jsonb,
  '{
    "icon": "layers",
    "color": "indigo",
    "tags": ["platform", "engineering", "devops"],
    "difficulty": "advanced"
  }'::jsonb
);

-- Add additional comprehensive role templates
INSERT INTO roles (name, description, experience, category, is_template, core_competencies, template_data) VALUES
-- Frontend Developer
(
  'Frontend Developer',
  'Develops user-facing features and interfaces using modern web technologies. Creates responsive, accessible, and performant web applications that provide excellent user experiences across different devices and browsers.',
  '2+ years',
  'Engineering',
  true,
  '{
    "frontend_frameworks": [
      "react",
      "vue",
      "angular",
      "svelte",
      "nextjs",
      "nuxt",
      "gatsby",
      "remix"
    ],
    "programming_languages": [
      "javascript",
      "typescript",
      "html",
      "css",
      "sass",
      "scss",
      "less",
      "stylus"
    ],
    "styling_tools": [
      "tailwind_css",
      "styled_components",
      "emotion",
      "css_modules",
      "bootstrap",
      "material_ui",
      "chakra_ui",
      "ant_design"
    ],
    "build_tools": [
      "webpack",
      "vite",
      "rollup",
      "parcel",
      "esbuild",
      "babel",
      "postcss",
      "autoprefixer"
    ],
    "testing": [
      "jest",
      "vitest",
      "cypress",
      "playwright",
      "testing_library",
      "enzyme",
      "storybook",
      "chromatic"
    ],
    "performance": [
      "lighthouse",
      "web_vitals",
      "bundle_analysis",
      "code_splitting",
      "lazy_loading",
      "caching",
      "cdn",
      "optimization"
    ]
  }'::jsonb,
  '{
    "icon": "monitor",
    "color": "blue",
    "tags": ["frontend", "web", "ui"],
    "difficulty": "intermediate"
  }'::jsonb
),
-- Backend Developer
(
  'Backend Developer',
  'Develops server-side logic, APIs, and database systems that power web and mobile applications. Ensures scalable, secure, and maintainable backend infrastructure with proper data management and API design.',
  '2+ years',
  'Engineering',
  true,
  '{
    "programming_languages": [
      "python",
      "java",
      "csharp",
      "nodejs",
      "go",
      "rust",
      "php",
      "ruby"
    ],
    "frameworks": [
      "django",
      "flask",
      "fastapi",
      "spring_boot",
      "express",
      "nest",
      "gin",
      "actix"
    ],
    "databases": [
      "postgresql",
      "mysql",
      "mongodb",
      "redis",
      "elasticsearch",
      "cassandra",
      "dynamodb",
      "sqlite"
    ],
    "api_design": [
      "rest_apis",
      "graphql",
      "grpc",
      "openapi",
      "swagger",
      "api_versioning",
      "rate_limiting",
      "authentication"
    ],
    "cloud_platforms": [
      "aws",
      "azure",
      "gcp",
      "heroku",
      "vercel",
      "netlify",
      "digital_ocean",
      "linode"
    ],
    "devops_tools": [
      "docker",
      "kubernetes",
      "jenkins",
      "github_actions",
      "gitlab_ci",
      "terraform",
      "ansible",
      "monitoring"
    ]
  }'::jsonb,
  '{
    "icon": "server",
    "color": "green",
    "tags": ["backend", "api", "server"],
    "difficulty": "intermediate"
  }'::jsonb
),
-- Full-Stack Developer
(
  'Full-Stack Developer',
  'Develops both frontend and backend components of web applications. Handles the complete development lifecycle from user interface design to server-side logic and database management.',
  '3+ years',
  'Engineering',
  true,
  '{
    "frontend_skills": [
      "react",
      "vue",
      "angular",
      "javascript",
      "typescript",
      "html",
      "css",
      "responsive_design"
    ],
    "backend_skills": [
      "nodejs",
      "python",
      "java",
      "csharp",
      "php",
      "ruby",
      "api_development",
      "database_design"
    ],
    "databases": [
      "postgresql",
      "mysql",
      "mongodb",
      "redis",
      "sqlite",
      "database_migration",
      "orm",
      "query_optimization"
    ],
    "deployment": [
      "docker",
      "kubernetes",
      "aws",
      "azure",
      "gcp",
      "heroku",
      "vercel",
      "ci_cd"
    ],
    "testing": [
      "unit_testing",
      "integration_testing",
      "e2e_testing",
      "jest",
      "cypress",
      "testing_library",
      "tdd",
      "bdd"
    ],
    "tools": [
      "git",
      "github",
      "gitlab",
      "webpack",
      "babel",
      "eslint",
      "prettier",
      "postman"
    ]
  }'::jsonb,
  '{
    "icon": "layers",
    "color": "purple",
    "tags": ["fullstack", "web", "development"],
    "difficulty": "advanced"
  }'::jsonb
),
-- DevOps Engineer
(
  'DevOps Engineer',
  'Manages infrastructure, deployment processes, and automation workflows. Ensures reliable, scalable, and secure application deployment with continuous integration and delivery practices.',
  '3+ years',
  'Engineering',
  true,
  '{
    "cloud_platforms": [
      "aws",
      "azure",
      "gcp",
      "digital_ocean",
      "linode",
      "multi_cloud",
      "hybrid_cloud",
      "cloud_migration"
    ],
    "containerization": [
      "docker",
      "kubernetes",
      "openshift",
      "rancher",
      "helm",
      "kustomize",
      "container_registry",
      "orchestration"
    ],
    "infrastructure_as_code": [
      "terraform",
      "cloudformation",
      "pulumi",
      "ansible",
      "chef",
      "puppet",
      "saltstack",
      "arm_templates"
    ],
    "ci_cd": [
      "jenkins",
      "gitlab_ci",
      "github_actions",
      "azure_devops",
      "circleci",
      "travis_ci",
      "bamboo",
      "teamcity"
    ],
    "monitoring": [
      "prometheus",
      "grafana",
      "datadog",
      "new_relic",
      "splunk",
      "elk_stack",
      "zabbix",
      "nagios"
    ],
    "security": [
      "vulnerability_scanning",
      "security_auditing",
      "compliance",
      "secrets_management",
      "iam",
      "network_security",
      "container_security",
      "devsecops"
    ]
  }'::jsonb,
  '{
    "icon": "settings",
    "color": "orange",
    "tags": ["devops", "infrastructure", "automation"],
    "difficulty": "advanced"
  }'::jsonb
),
-- QA Engineer
(
  'QA Engineer',
  'Tests software quality and ensures bug-free releases through comprehensive testing strategies. Designs and implements automated testing frameworks to maintain high code quality and user satisfaction.',
  '2+ years',
  'Engineering',
  true,
  '{
    "testing_methodologies": [
      "manual_testing",
      "automated_testing",
      "unit_testing",
      "integration_testing",
      "system_testing",
      "acceptance_testing",
      "performance_testing",
      "security_testing"
    ],
    "automation_tools": [
      "selenium",
      "cypress",
      "playwright",
      "puppeteer",
      "testcafe",
      "katalon",
      "appium",
      "rest_assured"
    ],
    "programming": [
      "java",
      "python",
      "javascript",
      "csharp",
      "ruby",
      "php",
      "typescript",
      "bash"
    ],
    "test_frameworks": [
      "junit",
      "testng",
      "pytest",
      "jest",
      "mocha",
      "jasmine",
      "nunit",
      "rspec"
    ],
    "ci_cd_integration": [
      "jenkins",
      "gitlab_ci",
      "github_actions",
      "azure_devops",
      "bamboo",
      "teamcity",
      "circleci",
      "travis_ci"
    ],
    "bug_tracking": [
      "jira",
      "bugzilla",
      "mantis",
      "redmine",
      "azure_devops",
      "github_issues",
      "linear",
      "asana"
    ]
  }'::jsonb,
  '{
    "icon": "shield-check",
    "color": "green",
    "tags": ["qa", "testing", "quality"],
    "difficulty": "intermediate"
  }'::jsonb
),
-- Data Scientist
(
  'Data Scientist',
  'Analyzes complex data to extract insights and build predictive models. Combines statistical analysis, machine learning, and domain expertise to solve business problems and drive data-driven decision making.',
  '3+ years',
  'Engineering',
  true,
  '{
    "programming": [
      "python",
      "r",
      "sql",
      "scala",
      "julia",
      "matlab",
      "sas",
      "spss"
    ],
    "machine_learning": [
      "supervised_learning",
      "unsupervised_learning",
      "deep_learning",
      "reinforcement_learning",
      "feature_engineering",
      "model_selection",
      "hyperparameter_tuning",
      "cross_validation"
    ],
    "frameworks": [
      "scikit_learn",
      "tensorflow",
      "pytorch",
      "keras",
      "pandas",
      "numpy",
      "scipy",
      "statsmodels"
    ],
    "data_visualization": [
      "matplotlib",
      "seaborn",
      "plotly",
      "d3js",
      "tableau",
      "power_bi",
      "ggplot2",
      "bokeh"
    ],
    "big_data": [
      "hadoop",
      "spark",
      "kafka",
      "hive",
      "pig",
      "hbase",
      "cassandra",
      "elasticsearch"
    ],
    "statistics": [
      "descriptive_statistics",
      "inferential_statistics",
      "hypothesis_testing",
      "regression_analysis",
      "time_series",
      "bayesian_statistics",
      "ab_testing",
      "experimental_design"
    ]
  }'::jsonb,
  '{
    "icon": "brain",
    "color": "purple",
    "tags": ["data", "ml", "analytics"],
    "difficulty": "advanced"
  }'::jsonb
),
-- System Administrator
(
  'System Administrator',
  'Manages IT systems and infrastructure to ensure optimal performance, security, and reliability. Maintains servers, networks, and software systems while providing technical support and implementing best practices.',
  '3+ years',
  'Engineering',
  true,
  '{
    "operating_systems": [
      "linux",
      "windows_server",
      "unix",
      "centos",
      "ubuntu",
      "red_hat",
      "debian",
      "suse"
    ],
    "networking": [
      "tcp_ip",
      "dns",
      "dhcp",
      "vpn",
      "firewalls",
      "routing",
      "switching",
      "load_balancing"
    ],
    "virtualization": [
      "vmware",
      "hyper_v",
      "virtualbox",
      "kvm",
      "xen",
      "proxmox",
      "containers",
      "docker"
    ],
    "monitoring": [
      "nagios",
      "zabbix",
      "prometheus",
      "grafana",
      "splunk",
      "elk_stack",
      "new_relic",
      "datadog"
    ],
    "automation": [
      "ansible",
      "puppet",
      "chef",
      "saltstack",
      "powershell",
      "bash",
      "python",
      "ruby"
    ],
    "security": [
      "access_control",
      "user_management",
      "backup_recovery",
      "disaster_recovery",
      "patch_management",
      "vulnerability_management",
      "compliance",
      "auditing"
    ]
  }'::jsonb,
  '{
    "icon": "server",
    "color": "gray",
    "tags": ["sysadmin", "infrastructure", "support"],
    "difficulty": "intermediate"
  }'::jsonb
),
-- UI/UX Designer
(
  'UI/UX Designer',
  'Designs user interfaces and user experiences for digital products. Creates intuitive, accessible, and visually appealing designs that enhance user satisfaction and drive business goals.',
  '2+ years',
  'Design',
  true,
  '{
    "design_tools": [
      "figma",
      "sketch",
      "adobe_xd",
      "invision",
      "principle",
      "framer",
      "protopie",
      "zeplin"
    ],
    "user_research": [
      "user_interviews",
      "usability_testing",
      "surveys",
      "personas",
      "user_journeys",
      "card_sorting",
      "tree_testing",
      "analytics"
    ],
    "design_systems": [
      "design_tokens",
      "component_libraries",
      "style_guides",
      "brand_guidelines",
      "accessibility",
      "responsive_design",
      "mobile_first",
      "atomic_design"
    ],
    "prototyping": [
      "wireframing",
      "mockups",
      "interactive_prototypes",
      "user_flows",
      "information_architecture",
      "navigation_design",
      "micro_interactions",
      "animation"
    ],
    "collaboration": [
      "stakeholder_management",
      "developer_handoff",
      "design_reviews",
      "feedback_incorporation",
      "cross_functional_teams",
      "agile_methodology",
      "design_sprints",
      "workshops"
    ],
    "technical_skills": [
      "html",
      "css",
      "javascript",
      "react",
      "vue",
      "responsive_design",
      "performance",
      "seo"
    ]
  }'::jsonb,
  '{
    "icon": "palette",
    "color": "pink",
    "tags": ["ui", "ux", "design"],
    "difficulty": "intermediate"
  }'::jsonb
),
-- Graphic Designer
(
  'Graphic Designer',
  'Creates visual designs and graphics for various platforms including print, web, and digital media. Develops brand identities, marketing materials, and visual communications that effectively convey messages and engage audiences.',
  '2+ years',
  'Design',
  true,
  '{
    "design_software": [
      "adobe_photoshop",
      "adobe_illustrator",
      "adobe_indesign",
      "adobe_after_effects",
      "sketch",
      "figma",
      "canva",
      "affinity_designer"
    ],
    "design_principles": [
      "typography",
      "color_theory",
      "composition",
      "balance",
      "contrast",
      "hierarchy",
      "spacing",
      "alignment"
    ],
    "branding": [
      "logo_design",
      "brand_identity",
      "style_guides",
      "brand_guidelines",
      "visual_identity",
      "brand_strategy",
      "market_research",
      "competitive_analysis"
    ],
    "print_design": [
      "brochures",
      "flyers",
      "posters",
      "business_cards",
      "packaging",
      "magazines",
      "books",
      "annual_reports"
    ],
    "digital_design": [
      "web_design",
      "social_media",
      "email_templates",
      "banners",
      "infographics",
      "presentations",
      "mobile_apps",
      "icons"
    ],
    "project_management": [
      "client_communication",
      "project_timelines",
      "file_organization",
      "version_control",
      "feedback_incorporation",
      "quality_assurance",
      "delivery_formats",
      "asset_management"
    ]
  }'::jsonb,
  '{
    "icon": "image",
    "color": "blue",
    "tags": ["graphic", "visual", "branding"],
    "difficulty": "intermediate"
  }'::jsonb
),
-- Product Manager
(
  'Product Manager',
  'Manages product strategy and roadmap to deliver value to customers and achieve business objectives. Coordinates with cross-functional teams to define requirements, prioritize features, and ensure successful product delivery.',
  '3+ years',
  'Product',
  true,
  '{
    "product_strategy": [
      "market_research",
      "competitive_analysis",
      "user_research",
      "product_vision",
      "roadmap_planning",
      "feature_prioritization",
      "go_to_market",
      "pricing_strategy"
    ],
    "stakeholder_management": [
      "executive_communication",
      "cross_functional_collaboration",
      "customer_interviews",
      "sales_alignment",
      "marketing_coordination",
      "engineering_partnership",
      "design_collaboration",
      "support_team_work"
    ],
    "agile_methodology": [
      "scrum",
      "kanban",
      "sprint_planning",
      "user_stories",
      "acceptance_criteria",
      "backlog_management",
      "retrospectives",
      "daily_standups"
    ],
    "analytics": [
      "product_analytics",
      "user_behavior",
      "conversion_tracking",
      "a_b_testing",
      "cohort_analysis",
      "funnel_analysis",
      "kpi_definition",
      "roi_measurement"
    ],
    "tools": [
      "jira",
      "confluence",
      "notion",
      "figma",
      "mixpanel",
      "amplitude",
      "google_analytics",
      "slack"
    ],
    "communication": [
      "presentation_skills",
      "technical_writing",
      "requirements_documentation",
      "user_documentation",
      "training_materials",
      "change_management",
      "conflict_resolution",
      "negotiation"
    ]
  }'::jsonb,
  '{
    "icon": "target",
    "color": "orange",
    "tags": ["product", "strategy", "management"],
    "difficulty": "advanced"
  }'::jsonb
),
-- Project Manager
(
  'Project Manager',
  'Manages project timelines and team coordination to ensure successful project delivery. Plans, executes, and monitors projects while managing resources, risks, and stakeholder expectations.',
  '3+ years',
  'Product',
  true,
  '{
    "project_methodologies": [
      "agile",
      "scrum",
      "kanban",
      "waterfall",
      "prince2",
      "pmp",
      "lean",
      "six_sigma"
    ],
    "planning_tools": [
      "microsoft_project",
      "jira",
      "asana",
      "trello",
      "monday",
      "smartsheet",
      "notion",
      "confluence"
    ],
    "risk_management": [
      "risk_identification",
      "risk_assessment",
      "risk_mitigation",
      "contingency_planning",
      "issue_tracking",
      "change_management",
      "quality_assurance",
      "compliance"
    ],
    "team_management": [
      "resource_allocation",
      "team_coordination",
      "performance_management",
      "conflict_resolution",
      "motivation",
      "communication",
      "leadership",
      "mentoring"
    ],
    "stakeholder_management": [
      "client_communication",
      "status_reporting",
      "expectation_management",
      "presentation_skills",
      "negotiation",
      "vendor_management",
      "executive_updates",
      "feedback_collection"
    ],
    "budgeting": [
      "cost_estimation",
      "budget_tracking",
      "resource_planning",
      "financial_reporting",
      "roi_analysis",
      "cost_optimization",
      "procurement",
      "contract_management"
    ]
  }'::jsonb,
  '{
    "icon": "calendar",
    "color": "blue",
    "tags": ["project", "management", "coordination"],
    "difficulty": "intermediate"
  }'::jsonb
),
-- Marketing Specialist
(
  'Marketing Specialist',
  'Handles marketing strategies and campaigns to promote products and services. Develops and executes marketing initiatives across various channels to drive brand awareness, lead generation, and customer acquisition.',
  '2+ years',
  'Marketing',
  true,
  '{
    "digital_marketing": [
      "seo",
      "sem",
      "ppc",
      "social_media_marketing",
      "email_marketing",
      "content_marketing",
      "influencer_marketing",
      "affiliate_marketing"
    ],
    "analytics": [
      "google_analytics",
      "facebook_analytics",
      "adobe_analytics",
      "mixpanel",
      "amplitude",
      "conversion_tracking",
      "attribution_modeling",
      "roi_measurement"
    ],
    "content_creation": [
      "blog_writing",
      "social_media_content",
      "email_campaigns",
      "landing_pages",
      "video_content",
      "infographics",
      "case_studies",
      "whitepapers"
    ],
    "tools": [
      "hubspot",
      "marketo",
      "mailchimp",
      "hootsuite",
      "buffer",
      "canva",
      "adobe_creative_suite",
      "google_ads"
    ],
    "strategy": [
      "market_research",
      "competitive_analysis",
      "customer_segmentation",
      "persona_development",
      "campaign_planning",
      "budget_allocation",
      "kpi_definition",
      "performance_optimization"
    ],
    "communication": [
      "brand_messaging",
      "copywriting",
      "presentation_skills",
      "stakeholder_communication",
      "cross_functional_collaboration",
      "client_management",
      "vendor_management",
      "event_management"
    ]
  }'::jsonb,
  '{
    "icon": "megaphone",
    "color": "green",
    "tags": ["marketing", "digital", "campaigns"],
    "difficulty": "intermediate"
  }'::jsonb
),
-- Content Writer
(
  'Content Writer',
  'Creates written content for various platforms including websites, blogs, social media, and marketing materials. Develops engaging, informative, and SEO-optimized content that drives traffic and converts readers into customers.',
  '2+ years',
  'Marketing',
  true,
  '{
    "writing_skills": [
      "copywriting",
      "blog_writing",
      "technical_writing",
      "creative_writing",
      "seo_writing",
      "email_writing",
      "social_media_writing",
      "press_releases"
    ],
    "content_types": [
      "articles",
      "blog_posts",
      "case_studies",
      "whitepapers",
      "ebooks",
      "landing_pages",
      "product_descriptions",
      "email_campaigns"
    ],
    "seo": [
      "keyword_research",
      "on_page_seo",
      "content_optimization",
      "meta_descriptions",
      "title_tags",
      "internal_linking",
      "content_structure",
      "search_analytics"
    ],
    "research": [
      "market_research",
      "competitor_analysis",
      "trend_analysis",
      "source_verification",
      "fact_checking",
      "interview_skills",
      "data_interpretation",
      "statistical_analysis"
    ],
    "tools": [
      "grammarly",
      "hemingway",
      "google_docs",
      "notion",
      "trello",
      "canva",
      "adobe_creative_suite",
      "wordpress"
    ],
    "collaboration": [
      "editorial_calendars",
      "content_strategy",
      "stakeholder_communication",
      "feedback_incorporation",
      "brand_voice",
      "style_guides",
      "content_approval",
      "publishing_workflows"
    ]
  }'::jsonb,
  '{
    "icon": "pen-tool",
    "color": "purple",
    "tags": ["content", "writing", "seo"],
    "difficulty": "intermediate"
  }'::jsonb
),
-- Sales Representative
(
  'Sales Representative',
  'Manages customer relationships and sales processes to drive revenue growth. Identifies prospects, nurtures leads, and closes deals while maintaining strong customer relationships and achieving sales targets.',
  '2+ years',
  'Sales',
  true,
  '{
    "sales_process": [
      "prospecting",
      "lead_qualification",
      "needs_assessment",
      "presentation_skills",
      "objection_handling",
      "negotiation",
      "closing_techniques",
      "follow_up"
    ],
    "crm_tools": [
      "salesforce",
      "hubspot",
      "pipedrive",
      "zoho_crm",
      "monday",
      "notion",
      "airtable",
      "excel"
    ],
    "communication": [
      "cold_calling",
      "email_outreach",
      "social_selling",
      "presentation_skills",
      "active_listening",
      "relationship_building",
      "customer_service",
      "conflict_resolution"
    ],
    "product_knowledge": [
      "product_demos",
      "feature_explanations",
      "competitive_analysis",
      "pricing_strategy",
      "value_proposition",
      "use_cases",
      "integration_options",
      "technical_specifications"
    ],
    "analytics": [
      "sales_forecasting",
      "pipeline_management",
      "conversion_tracking",
      "activity_reporting",
      "kpi_measurement",
      "territory_analysis",
      "market_research",
      "customer_insights"
    ],
    "industry_knowledge": [
      "market_trends",
      "customer_pain_points",
      "competitive_landscape",
      "regulatory_requirements",
      "industry_standards",
      "best_practices",
      "case_studies",
      "success_stories"
    ]
  }'::jsonb,
  '{
    "icon": "trending-up",
    "color": "green",
    "tags": ["sales", "revenue", "relationships"],
    "difficulty": "intermediate"
  }'::jsonb
);

-- Update existing basic roles to have proper categories
UPDATE roles SET category = 'Engineering' WHERE name IN (
  'Front-end Developer', 'Back-end Developer', 'Full-stack Developer', 
  'DevOps Engineer', 'QA Engineer', 'Data Scientist', 'System Administrator'
);

UPDATE roles SET category = 'Design' WHERE name IN (
  'UI/UX Designer', 'Graphic Designer'
);

UPDATE roles SET category = 'Product' WHERE name IN (
  'Product Manager', 'Project Manager', 'Business Analyst'
);

UPDATE roles SET category = 'Marketing' WHERE name IN (
  'Marketing Specialist', 'Content Writer'
);

UPDATE roles SET category = 'Sales' WHERE name IN (
  'Sales Representative'
);
