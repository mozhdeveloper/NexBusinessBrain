# API Flow for Cayebel AI Assistant

## POST /api/ai/documents/upload

Purpose:
Upload SOP/manual/policy documents and index them into vector DB.

Input:
- company_id
- file
- document_type
- uploaded_by

Process:
1. Extract text.
2. Chunk text.
3. Create embeddings.
4. Store chunks in vector DB with metadata.

## POST /api/ai/chat

Input:
{
  "company_id": "cayebel",
  "user_id": "user_001",
  "page_context": "dashboard",
  "client_id": "optional",
  "deal_id": "optional",
  "equipment_id": "optional",
  "question": "Which clients should sales follow up today?"
}

Process:
1. Classify question.
2. If DOCUMENT_QA, use search_documents.
3. If CLIENT_SUMMARY, call get_client_profile + get_pms_status.
4. If FOLLOW_UP_PRIORITY, call get_follow_up_priorities.
5. If PMS_RECOMMENDATION, call get_pms_status + search_documents.
6. Generate answer.

Output:
{
  "direct_answer": "",
  "reasoning_summary": "",
  "data_checked": [],
  "source_documents": [],
  "recommended_next_action": "",
  "missing_information": []
}

## AI Tools

get_client_profile(client_id)
get_sales_performance(date_range)
get_follow_up_priorities(date)
get_deal_details(deal_id)
get_pms_status(client_id, equipment_id)
search_documents(company_id, query)
