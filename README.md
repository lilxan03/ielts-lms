# IELTS AI grading function

This function grades Writing responses and transcribes/grades Speaking recordings. The browser only calls the function; the model key stays in Firebase Secret Manager.

## Deploy

From this directory:

```powershell
npm install
firebase login
firebase use khanh-ielts
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions:gradeIELTSSubmission
```

The frontend calls:

`https://us-central1-khanh-ielts.cloudfunctions.net/gradeIELTSSubmission`

The teacher opens a Writing or Speaking submission, clicks **AI Grade Draft**, reviews the returned bands and feedback, then clicks **Save Grades & Feedback**.

Speaking recordings must be downloadable by the function. Firebase Storage download URLs are supported. The AI draft is not an official IELTS score and should be reviewed by a qualified teacher.
