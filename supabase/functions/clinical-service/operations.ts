import {
  getConsultationDraftAction,
  saveConsultationDraftAction,
} from "./domain/actions/clinical/visits/drafts.ts";
import * as domain0 from "./domain/actions/clinical/visits/queries.ts";
import * as domain1 from "./domain/actions/clinical/visits/history.ts";
import * as domain2 from "./domain/actions/clinical/visits/workflow.ts";
import * as domain3 from "./domain/actions/clinical/queues.ts";
import * as domain4 from "./domain/actions/rfid/queue.ts";
import * as domain5 from "./domain/actions/clinical/records/compliance.ts";
import * as domain6 from "./domain/actions/clinical/records/faculty-documents.ts";
import * as domain7 from "./domain/actions/clinical/records/my-consultations.ts";
import * as domain8 from "./domain/actions/clinical/records/patient-records.ts";
import * as domain9 from "./domain/actions/clinical/records/resources.ts";
import * as domain10 from "./domain/actions/clinical/records/search.ts";
import * as domain11 from "./domain/actions/clinical/records/staff-documents.ts";
import * as domain12 from "./domain/actions/clinical/records/staff-records.ts";
import * as flexible from "./domain/actions/clinical/visits/flexible.ts";
import * as forms from "./domain/actions/clinical/visits/forms.ts";

// Explicit operation allowlist; callers cannot choose tables or SQL.
export const operations = {
  clinicFormsConfigAction: forms.clinicFormsConfigAction,
  issueClinicFormsAction: forms.issueClinicFormsAction,
  getClinicFormAction: forms.getClinicFormAction,
  uploadClinicScanAction: forms.uploadClinicScanAction,
  reviewClinicScanAction: forms.reviewClinicScanAction,
  searchManualVisitPatientsAction: flexible.searchManualVisitPatientsAction,
  createManualVisitAction: flexible.createManualVisitAction,
  getWorkflowSupportAction: flexible.getWorkflowSupportAction,
  recordCoordinationAction: flexible.recordCoordinationAction,
  manageClinicalProtocolAction: flexible.manageClinicalProtocolAction,
  nurseDutyStatusAction: flexible.nurseDutyStatusAction,
  getClinicCoordinationQueueAction: flexible.getClinicCoordinationQueueAction,
  claimNurseAssistanceAction: flexible.claimNurseAssistanceAction,
  requestConsultationClearanceAction: flexible.requestConsultationClearanceAction,
  getConsultationDraftAction,
  saveConsultationDraftAction,
  getClinicVisitsAction: domain0.getClinicVisitsAction,
  getConsultationDetailAction: domain0.getConsultationDetailAction,
  updateConsultationNotesAction: domain0.updateConsultationNotesAction,
  getClinicalVisitHistoryAction: domain1.getClinicalVisitHistoryAction,
  createTriageAssessmentAction: domain2.createTriageAssessmentAction,
  claimConsultationWorkflowAction: domain2.claimConsultationWorkflowAction,
  startConsultationWorkflowAction: domain2.startConsultationWorkflowAction,
  setVitalsDispositionAction: domain2.setVitalsDispositionAction,
  completeClinicalConsultationAction:
    domain2.completeClinicalConsultationAction,
  finalizeConsultationWorkflowAction:
    domain2.finalizeConsultationWorkflowAction,
  getConsultationLookupCatalogsAction:
    domain2.getConsultationLookupCatalogsAction,
  getAvailableReviewDoctorsAction: domain2.getAvailableReviewDoctorsAction,
  getMyClinicianDutyStatusAction: domain2.getMyClinicianDutyStatusAction,
  setMyClinicianDutyStatusAction: domain2.setMyClinicianDutyStatusAction,
  reassignConsultationReviewAction: domain2.reassignConsultationReviewAction,
  getVisitReasonCatalogAction: domain2.getVisitReasonCatalogAction,
  getConsultationQueueAction: domain3.getConsultationQueueAction,
  getStaffHealthConsultationsAction: domain3.getStaffHealthConsultationsAction,
  getRfidQueueAction: domain4.getRfidQueueAction,
  searchPatientProfilesAction: domain5.searchPatientProfilesAction,
  getOwnPatientProfileAction: domain5.getOwnPatientProfileAction,
  getComplianceRecordAction: domain5.getComplianceRecordAction,
  getAggregatedDocumentsAction: domain5.getAggregatedDocumentsAction,
  getComplianceDocumentUrlAction: domain5.getComplianceDocumentUrlAction,
  addClinicalSectionAction: domain5.addClinicalSectionAction,
  uploadMedicalExamAction: domain5.uploadMedicalExamAction,
  uploadGeneralDocumentAction: domain5.uploadGeneralDocumentAction,
  uploadSickLeaveAction: domain5.uploadSickLeaveAction,
  getFacultyDocumentsAction: domain6.getFacultyDocumentsAction,
  uploadFacultyDocumentAction: domain6.uploadFacultyDocumentAction,
  getMyConsultationWorkspaceAction: domain7.getMyConsultationWorkspaceAction,
  getPatientMedicalRecordAction: domain8.getPatientMedicalRecordAction,
  getOwnMedicalRecordAction: domain8.getOwnMedicalRecordAction,
  addPatientAllergyAction: domain8.addPatientAllergyAction,
  updatePatientMedicationAction: domain8.updatePatientMedicationAction,
  addPatientMedicationAction: domain8.addPatientMedicationAction,
  addPatientImmunizationAction: domain8.addPatientImmunizationAction,
  addMedicalHistoryAction: domain8.addMedicalHistoryAction,
  updatePatientMedicalRecordAction: domain8.updatePatientMedicalRecordAction,
  getStudentDocumentsAction: domain9.getStudentDocumentsAction,
  getEmergencyContactsAction: domain9.getEmergencyContactsAction,
  uploadStudentDocumentAction: domain9.uploadStudentDocumentAction,
  searchRecordsAction: domain10.searchRecordsAction,
  getStaffDocumentsAction: domain11.getStaffDocumentsAction,
  uploadStaffDocumentAction: domain11.uploadStaffDocumentAction,
  deleteStaffDocumentAction: domain11.deleteStaffDocumentAction,
  getStaffMedicalHistoryAction: domain12.getStaffMedicalHistoryAction,
  addStaffMedicalHistoryAction: domain12.addStaffMedicalHistoryAction,
  getStaffAllergiesAction: domain12.getStaffAllergiesAction,
  addStaffAllergyAction: domain12.addStaffAllergyAction,
  getStaffMedicationsAction: domain12.getStaffMedicationsAction,
  addStaffMedicationAction: domain12.addStaffMedicationAction,
  getStaffImmunizationsAction: domain12.getStaffImmunizationsAction,
  addStaffImmunizationAction: domain12.addStaffImmunizationAction,
  getStaffMedicalRecordAction: domain12.getStaffMedicalRecordAction,
};
