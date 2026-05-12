# Cayebel SmartOps AI Demo Data

This package is dummy data for the Cayebel CRM/PMS + RAG/Reasoning RAG MVP demo.

## Folder Structure

structured_tables/
- clients.csv
- equipment.csv
- deals.csv
- tasks.csv
- pms_schedules.csv
- service_logs.csv
- sales_performance.csv

documents_for_rag/
- company_profile.md
- sop_sales_follow_up.md
- sop_pms_and_calibration.md
- warranty_and_service_policy.md
- gps_fleet_tracking_policy.md
- service_package_menu.md
- sales_scripts.md

Other files:
- decision_rules.json
- demo_questions.md

## How to Use

1. Import CSV files into the CRM/PMS database.
2. Upload documents_for_rag into the document library.
3. Index documents using LlamaIndex + vector DB.
4. Let the AI assistant use:
   - structured database tools for CRM/PMS records
   - document search for SOP/manual/policy answers
   - reasoning model for recommendations

## AI Answer Format

Return all AI answers as:

Direct Answer:
Reasoning Summary:
Data Checked:
Source Documents:
Recommended Next Action:
Missing Information:

## Best Demo Flow

1. Open Manager Dashboard.
2. Ask: "What should the manager focus on today?"
3. Open Sales Analytics.
4. Ask: "Which deals are at risk?"
5. Open MetroBuild client profile.
6. Ask: "Summarize this client and suggest next action."
7. Open PMS page.
8. Ask: "Which equipment is overdue for PMS?"
9. Ask document question: "What should technician check during PMS?"
