# Past-paper feature completion requirements

These are acceptance criteria for the existing Study Buddy AI implementation. They apply to every course, including courses created by users after deployment.

## 1. Complete, page-aware extraction
- Process every page or slide returned by the existing document/OCR pipeline.
- Retain page/slide provenance for extracted questions.
- Preserve the original order, numbering, section headings, sub-question labels, marks, wording, and MCQ option order.
- Do not silently truncate the paper or report complete processing when extraction failed for a page.
- Keep deterministic parsing and AI-assisted extraction source-verified; never invent question text.

## 2. Unreadable or missing content
- Identify pages with no usable extracted text or incomplete/uncertain OCR.
- Surface the affected page numbers and a clear request for a clearer scan or re-upload.
- Never silently omit an unreadable question or present an AI reconstruction as verbatim source text.
- Clearly distinguish exact transcription from any suggested interpretation that needs user verification.

## 3. Answer every extracted question
- Keep the original question immediately followed by its answer.
- Use course notes first when relevant; otherwise use clearly labelled general academic knowledge.
- Preserve the original MCQ options and choose only among them.
- Provide mark-appropriate explanations and worked calculation steps.
- Label uncertainty rather than fabricating an answer or citation.

## 4. Regression and release verification
- Add regression coverage for multi-page extraction, page provenance, ordering, numbering, sections, sub-questions, options, OCR gaps/unreadable pages, duplicate prevention, and answer-to-question mapping.
- Run the test suite, TypeScript/lint check, and production build; record actual outcomes and fix failures before declaring completion.
- Verify existing courses and newly created courses use the same flow, without subject-specific hard-coding.
- Verify the change does not regress uploads, course/folder selection, document processing, AI tutor, study sessions, or other existing app features.

## Definition of done
Do not mark this feature complete until the acceptance tests pass, the project checks pass, and the end-to-end workflow has been verified on representative multi-page papers in more than one course. If a check cannot be run, state that limitation explicitly.
