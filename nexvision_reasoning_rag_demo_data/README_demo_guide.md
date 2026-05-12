# NexVision Reasoning RAG MVP Demo Data

This package contains dummy company data for four demo sectors:

1. Construction - BuildWise Engineering Solutions
2. Hospital - MedNova Medical Center
3. BPO - VoiceHub CX Solutions
4. Logistics - SwiftLink Logistics

Use this data to build a Reasoning RAG demo.

Recommended demo behavior:
- User asks a question.
- AI searches relevant SOP, FAQ, and CSV records.
- AI gives answer.
- AI explains short reasoning.
- AI cites source document.
- AI recommends next action.
- AI asks follow-up question when data is missing.

Recommended output format:
1. Direct Answer
2. Reasoning Summary
3. Source Used
4. Recommended Next Action
5. Missing Information, if any

Demo questions:

Construction:
- "Client Northgate requested additional loading bay costing PHP 185,000. Who should approve and can work proceed?"
- "A worker had an electrical shock onsite. What should the team do?"
- "Can VistaMed Clinic's PHP 22,000 cabinet request be approved by the Project Manager?"

Hospital:
- "Ana Santos missed her MRI appointment and wants a refund. Is she eligible?"
- "Roberto Cruz cancelled surgery 30 hours before schedule. Who approves the refund?"
- "Can Liza Dela Peña be admitted even if HMO approval is still pending?"

BPO:
- "Customer asked for supervisor 3 times because of delayed refund. Should agent escalate?"
- "Fintech customer reports unauthorized transaction. What should agent do?"
- "Agent quality score is 82% for two weeks. What action is required?"

Logistics:
- "Tracking SL-1002 express delivery is delayed 55 hours. Is customer eligible for refund review?"
- "Tracking SL-1003 was damaged and reported within 12 hours. Who approves the claim?"
- "Tracking SL-1004 has 3 failed delivery attempts. What happens next?"
