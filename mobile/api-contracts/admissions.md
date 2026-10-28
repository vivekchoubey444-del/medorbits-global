# Admissions API Contract

**Base path:** `/api/v1`

This contract defines proposed endpoints for admission discovery, course and institution data, and informational eligibility assessments. It does not establish that any opportunity is open or that a listed fact is verified.

## 1. List admissions

`GET /api/v1/admissions`

Optional query parameters:

- `courseType`: string
- `country`: string
- `state`: string
- `year`: integer
- `limit`: integer, server-capped
- `cursor`: opaque string

Only publishable admission records should be returned to public clients.

Example response:

```json
{
  "success": true,
  "data": [
    {
      "id": "adm_example_001",
      "title": "MBBS Admissions",
      "courseType": "MBBS",
      "country": "IN",
      "state": "West Bengal",
      "admissionYear": 2027,
      "applicationOpenDate": null,
      "applicationCloseDate": null,
      "status": "published",
      "sourceUrl": null,
      "lastVerifiedAt": null
    }
  ],
  "meta": {
    "nextCursor": null,
    "hasMore": false,
    "requestId": "req_example"
  }
}
```

All example records are illustrative. `null` deadlines mean unknown or unavailable; they do not mean the application is open.

## 2. Get admission details

`GET /api/v1/admissions/{admissionId}`

Possible fields:

- `id`
- `title`
- `description`
- `courseType`
- `institutionIds`
- `country`
- `state`
- `admissionYear`
- `eligibilitySummary`
- `requiredDocumentTypes`
- `applicationOpenDate`
- `applicationCloseDate`
- `applicationInstructions`
- `fees`
- `status`
- `sourceUrl`
- `lastVerifiedAt`

Unknown values must be null or omitted. Record the source and verification timestamp for changing factual information.

## 3. List courses

`GET /api/v1/courses`

Optional query parameters: `category`, `country`, `search`, `limit`, `cursor`.

Example item:

```json
{
  "id": "course_example_001",
  "name": "Bachelor of Medicine and Bachelor of Surgery",
  "code": "MBBS",
  "category": "medical",
  "duration": null,
  "status": "published"
}
```

## 4. Get course

`GET /api/v1/courses/{courseId}`

Returns the published course record and verified metadata.

## 5. List institutions

`GET /api/v1/institutions`

Optional query parameters: `courseId`, `country`, `state`, `search`, `limit`, `cursor`.

## 6. Get institution

`GET /api/v1/institutions/{institutionId}`

Returns published institution information, location, official website, and associated courses where verified.

Do not claim accreditation, recognition, seat availability, affiliation, or official status without a verified source.

## 7. Assess eligibility

`POST /api/v1/eligibility/assess`

Authentication: Required.

Example request:

```json
{
  "admissionId": "adm_example_001",
  "education": {
    "qualification": "12th",
    "subjects": ["Physics", "Chemistry", "Biology"],
    "completionYear": 2026,
    "marksPercentage": 78.5
  },
  "entranceExam": {
    "examCode": "NEET_UG",
    "qualified": true,
    "score": null,
    "year": 2026
  }
}
```

Collect only the information needed for the requested assessment. Do not send identity documents to this endpoint.

Example response:

```json
{
  "success": true,
  "data": {
    "assessmentId": "elig_example_001",
    "admissionId": "adm_example_001",
    "result": "requires_review",
    "checks": [
      {
        "code": "ACADEMIC_REQUIREMENT",
        "status": "not_verified",
        "message": "Academic documents require verification."
      }
    ],
    "disclaimer": "This assessment is informational and does not guarantee admission."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Allowed results:

- `eligible`
- `not_eligible`
- `requires_review`
- `insufficient_information`

The server must use verified, versioned rules and clearly identify when the assessment is incomplete. Final decisions belong to the competent authority or institution.

## 8. Data quality

- Never fabricate deadlines, fees, cutoffs, seats, rankings, or eligibility rules.
- Store a source URL and verification date for material admissions claims where possible.
- Mark stale or unverified data.
- Do not expose unpublished records.
- Ensure filters and pagination are validated server-side.
