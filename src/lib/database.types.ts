/**
 * Regenerar: pnpm types:database
 * Fonte: schema public do Supabase de homolog (HOMOLOG_DATABASE_URL).
 * Este arquivo não contém secrets. O app permanece JavaScript.
 * Tabelas só de homolog (ingestão) aparecem aqui porque o schema ligado é o de homolog.
 * Isso não promove essas tabelas para prod.manifest.json.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "applications": {
                  Row: {
                    "candidate_id": string,"created_at": string,"id": string,"job_id": string,"snapshot": NonNullable<Json>,"status": Database["public"]['Enums']["application_status"],"updated_at": string
                  }
                  Insert: {
                    "candidate_id": string,"created_at"?: string,"id"?: string,"job_id": string,"snapshot"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["application_status"],"updated_at"?: string
                  }
                  Update: {
                    "candidate_id"?: string,"created_at"?: string,"id"?: string,"job_id"?: string,"snapshot"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["application_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "applications_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applications_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applications_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs_needing_moderation"
      referencedColumns: ["id"]
    }
                  ]
                },"apply_request_log": {
                  Row: {
                    "created_at": string,"id": number,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: never,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"companies": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"logo_path": string | null,"name": string,"updated_at": string,"website": string | null
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"logo_path"?: string | null,"name": string,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"logo_path"?: string | null,"name"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"job_curation_reviews": {
                  Row: {
                    "created_at": string,"curation_round": number,"decision": Database["public"]['Enums']["curation_decision"],"id": string,"internal_comment": string | null,"job_id": string,"reviewer_id": string,"rubric_code": string
                  }
                  Insert: {
                    "created_at"?: string,"curation_round": number,"decision": Database["public"]['Enums']["curation_decision"],"id"?: string,"internal_comment"?: string | null,"job_id": string,"reviewer_id": string,"rubric_code": string
                  }
                  Update: {
                    "created_at"?: string,"curation_round"?: number,"decision"?: Database["public"]['Enums']["curation_decision"],"id"?: string,"internal_comment"?: string | null,"job_id"?: string,"reviewer_id"?: string,"rubric_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_curation_reviews_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_curation_reviews_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs_needing_moderation"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_curation_reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"job_ingestion_attempts": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"failure_code": string | null,"failure_detail": string | null,"id": string,"ingestion_id": string,"job_id": string | null,"outcome": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"failure_code"?: string | null,"failure_detail"?: string | null,"id"?: string,"ingestion_id": string,"job_id"?: string | null,"outcome": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"failure_code"?: string | null,"failure_detail"?: string | null,"id"?: string,"ingestion_id"?: string,"job_id"?: string | null,"outcome"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_ingestion_attempts_ingestion_id_fkey"
      columns: ["ingestion_id"]
isOneToOne: false
      referencedRelation: "job_ingestion_staff_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_ingestion_attempts_ingestion_id_fkey"
      columns: ["ingestion_id"]
isOneToOne: false
      referencedRelation: "job_ingestions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_ingestion_attempts_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_ingestion_attempts_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs_needing_moderation"
      referencedColumns: ["id"]
    }
                  ]
                },"job_ingestions": {
                  Row: {
                    "canonical_payload": Json | null,"created_at": string,"expires_at": string | null,"id": string,"job_id": string | null,"normalized_locator": string,"payload_hash": string,"source_kind": string
                  }
                  Insert: {
                    "canonical_payload"?: Json | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"job_id"?: string | null,"normalized_locator": string,"payload_hash": string,"source_kind": string
                  }
                  Update: {
                    "canonical_payload"?: Json | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"job_id"?: string | null,"normalized_locator"?: string,"payload_hash"?: string,"source_kind"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_ingestions_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_ingestions_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs_needing_moderation"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "approved_at": string | null,"company_id": string,"country_code": string | null,"created_at": string,"curation_round": number,"description": string,"embedding": string | null,"embedding_model": string | null,"embedding_updated_at": string | null,"enriched_description": string | null,"id": string,"level": string,"location": string | null,"priority": Database["public"]['Enums']["job_priority"],"priority_reason": string | null,"rejected_at": string | null,"requirements": NonNullable<Json>,"salary_currency": string,"salary_max": number | null,"salary_min": number | null,"stack": (string)[],"status": Database["public"]['Enums']["job_status"],"submitted_by": string | null,"title": string,"updated_at": string,"work_model": string
                  }
                  Insert: {
                    "approved_at"?: string | null,"company_id": string,"country_code"?: string | null,"created_at"?: string,"curation_round"?: number,"description": string,"embedding"?: string | null,"embedding_model"?: string | null,"embedding_updated_at"?: string | null,"enriched_description"?: string | null,"id"?: string,"level": string,"location"?: string | null,"priority"?: Database["public"]['Enums']["job_priority"],"priority_reason"?: string | null,"rejected_at"?: string | null,"requirements"?: NonNullable<Json>,"salary_currency"?: string,"salary_max"?: number | null,"salary_min"?: number | null,"stack"?: (string)[],"status"?: Database["public"]['Enums']["job_status"],"submitted_by"?: string | null,"title": string,"updated_at"?: string,"work_model": string
                  }
                  Update: {
                    "approved_at"?: string | null,"company_id"?: string,"country_code"?: string | null,"created_at"?: string,"curation_round"?: number,"description"?: string,"embedding"?: string | null,"embedding_model"?: string | null,"embedding_updated_at"?: string | null,"enriched_description"?: string | null,"id"?: string,"level"?: string,"location"?: string | null,"priority"?: Database["public"]['Enums']["job_priority"],"priority_reason"?: string | null,"rejected_at"?: string | null,"requirements"?: NonNullable<Json>,"salary_currency"?: string,"salary_max"?: number | null,"salary_min"?: number | null,"stack"?: (string)[],"status"?: Database["public"]['Enums']["job_status"],"submitted_by"?: string | null,"title"?: string,"updated_at"?: string,"work_model"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"privacy_audit_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"event_type": string,"id": string,"metadata_minimal": NonNullable<Json>,"occurred_at": string,"purpose_code": string,"resource_id": string | null,"resource_type": string,"result": string,"retention_status": string,"subject_id": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"event_type": string,"id"?: string,"metadata_minimal"?: NonNullable<Json>,"occurred_at"?: string,"purpose_code": string,"resource_id"?: string | null,"resource_type": string,"result": string,"retention_status"?: string,"subject_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"event_type"?: string,"id"?: string,"metadata_minimal"?: NonNullable<Json>,"occurred_at"?: string,"purpose_code"?: string,"resource_id"?: string | null,"resource_type"?: string,"result"?: string,"retention_status"?: string,"subject_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"privacy_consent_events": {
                  Row: {
                    "created_at": string,"event_type": string,"id": string,"proof": NonNullable<Json>,"purpose_code": string,"purpose_version": number,"source": string,"subject_id": string
                  }
                  Insert: {
                    "created_at"?: string,"event_type": string,"id"?: string,"proof"?: NonNullable<Json>,"purpose_code": string,"purpose_version": number,"source": string,"subject_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_type"?: string,"id"?: string,"proof"?: NonNullable<Json>,"purpose_code"?: string,"purpose_version"?: number,"source"?: string,"subject_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "privacy_consent_events_purpose_code_purpose_version_fkey"
      columns: ["purpose_code","purpose_version"]
isOneToOne: false
      referencedRelation: "privacy_purposes"
      referencedColumns: ["purpose_code","version"]
    },{
      foreignKeyName: "privacy_consent_events_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"privacy_purposes": {
                  Row: {
                    "classification": string,"created_at": string,"legal_basis_status": string,"purpose_code": string,"retention_status": string,"revocation_effect": string,"specific_description": string,"status": string,"text_status": string,"title": string,"version": number
                  }
                  Insert: {
                    "classification": string,"created_at"?: string,"legal_basis_status"?: string,"purpose_code": string,"retention_status"?: string,"revocation_effect": string,"specific_description": string,"status"?: string,"text_status"?: string,"title": string,"version": number
                  }
                  Update: {
                    "classification"?: string,"created_at"?: string,"legal_basis_status"?: string,"purpose_code"?: string,"retention_status"?: string,"revocation_effect"?: string,"specific_description"?: string,"status"?: string,"text_status"?: string,"title"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string | null,"created_at": string,"full_name": string,"headline": string | null,"id": string,"preferences": NonNullable<Json>,"role": Database["public"]['Enums']["user_role"],"skills": (string)[],"updated_at": string
                  }
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string | null,"created_at"?: string,"full_name": string,"headline"?: string | null,"id": string,"preferences"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["user_role"],"skills"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string | null,"created_at"?: string,"full_name"?: string,"headline"?: string | null,"id"?: string,"preferences"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["user_role"],"skills"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "job_ingestion_staff_list": {
                  Row: {
                    "created_at": string | null,"expires_at": string | null,"id": string | null,"job_id": string | null,"job_status": Database["public"]['Enums']["job_status"] | null,"job_title": string | null,"latest_outcome": string | null,"normalized_locator": string | null,"payload_title": string | null,"source_kind": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_ingestions_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_ingestions_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs_needing_moderation"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs_needing_moderation": {
                  Row: {
                    "approved_at": string | null,"company_id": string | null,"created_at": string | null,"curation_round": number | null,"description": string | null,"embedding": string | null,"embedding_model": string | null,"embedding_updated_at": string | null,"enriched_description": string | null,"id": string | null,"level": string | null,"location": string | null,"priority": Database["public"]['Enums']["job_priority"] | null,"priority_reason": string | null,"rejected_at": string | null,"requirements": Json | null,"stack": (string)[] | null,"status": Database["public"]['Enums']["job_status"] | null,"submitted_by": string | null,"title": string | null,"updated_at": string | null,"work_model": string | null
                  }
                  Insert: {
                           "approved_at"?: string | null,"company_id"?: string | null,"created_at"?: string | null,"curation_round"?: number | null,"description"?: string | null,"embedding"?: string | null,"embedding_model"?: string | null,"embedding_updated_at"?: string | null,"enriched_description"?: string | null,"id"?: string | null,"level"?: string | null,"location"?: string | null,"priority"?: Database["public"]['Enums']["job_priority"] | null,"priority_reason"?: string | null,"rejected_at"?: string | null,"requirements"?: Json | null,"stack"?: (string)[] | null,"status"?: Database["public"]['Enums']["job_status"] | null,"submitted_by"?: string | null,"title"?: string | null,"updated_at"?: string | null,"work_model"?: string | null
                         }
                        Update: {
                           "approved_at"?: string | null,"company_id"?: string | null,"created_at"?: string | null,"curation_round"?: number | null,"description"?: string | null,"embedding"?: string | null,"embedding_model"?: string | null,"embedding_updated_at"?: string | null,"enriched_description"?: string | null,"id"?: string | null,"level"?: string | null,"location"?: string | null,"priority"?: Database["public"]['Enums']["job_priority"] | null,"priority_reason"?: string | null,"rejected_at"?: string | null,"requirements"?: Json | null,"stack"?: (string)[] | null,"status"?: Database["public"]['Enums']["job_status"] | null,"submitted_by"?: string | null,"title"?: string | null,"updated_at"?: string | null,"work_model"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "jobs_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "apply_to_job":
{ Args: { "p_job_id": string }; Returns: Json
                           },
"count_job_ingestions_needing_attention":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"create_admin_pending_job":
{ Args: { "p_payload": Json }; Returns: Json
                           },
"get_admin_dashboard_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"match_jobs":
{ Args: { "match_limit"?: number,"query_embedding": string,"requested_levels"?: (string)[],"requested_stack"?: (string)[],"requested_work_model"?: string }; Returns: {
              "explicit_score": number,"job_id": string,"match_score": number,"semantic_score": number
            }[]
                           },
"privacy_purpose_is_authorized":
{ Args: { "p_purpose_code": string }; Returns: boolean
                           },
"process_job_ingestion":
{ Args: { "p_expires_at"?: string,"p_locator": string,"p_payload": Json,"p_source_kind": string }; Returns: Json
                           },
"profile_meets_d01":
{ Args: { "p_email": string,"p_full_name": string,"p_preferences": Json,"p_skills": (string)[] }; Returns: boolean
                           },
"record_privacy_event":
{ Args: { "p_event_type": string,"p_purpose_code": string,"p_source"?: string }; Returns: {
              "created_at": string,
"event_type": string,
"id": string,
"proof": NonNullable<Json>,
"purpose_code": string,
"purpose_version": number,
"source": string,
"subject_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "privacy_consent_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"redact_audit_metadata":
{ Args: { "p_metadata": Json }; Returns: Json
                           },
"register_job_ingestion":
{ Args: { "p_expires_at"?: string,"p_job_id"?: string,"p_locator": string,"p_payload": Json,"p_source_kind": string }; Returns: Json
                           },
"request_purpose_access":
{ Args: { "p_event_type": string,"p_purpose_code": string }; Returns: Json
                           },
"resubmit_job_for_curation":
{ Args: { "p_job_id": string }; Returns: Json
                           },
"set_job_curation_priority":
{ Args: { "p_job_id": string,"p_priority": Database["public"]['Enums']["job_priority"],"p_reason"?: string }; Returns: Json
                           },
"submit_curation_review":
{ Args: { "p_decision": Database["public"]['Enums']["curation_decision"],"p_internal_comment"?: string,"p_job_id": string,"p_rubric_code": string }; Returns: Json
                           },
"withdraw_application":
{ Args: { "p_job_id": string }; Returns: Json
                           },
"write_privacy_audit_event":
{ Args: { "p_event_type": string,"p_metadata"?: Json,"p_purpose_code": string,"p_resource_id": string,"p_resource_type": string,"p_result": string,"p_subject_id"?: string }; Returns: string
                           }
          }
          Enums: {
            "application_status": "submitted"|"reviewing"|"accepted"|"rejected"|"withdrawn","curation_decision": "approve"|"reject","job_priority": "normal"|"urgent","job_status": "pending"|"approved"|"archived"|"rejected","user_role": "candidate"|"admin"|"curator"|"moderator"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "application_status": ["submitted", "reviewing", "accepted", "rejected", "withdrawn"],"curation_decision": ["approve", "reject"],"job_priority": ["normal", "urgent"],"job_status": ["pending", "approved", "archived", "rejected"],"user_role": ["candidate", "admin", "curator", "moderator"]
          }
        }
} as const
