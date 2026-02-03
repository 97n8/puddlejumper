import { graphGet } from "./graph.js";
import { toGraphDateTime } from "./time.js";

export async function getMe(auth) {
  return await graphGet(auth, "/me?$select=displayName,mail,userPrincipalName");
}

export async function getMyCalendarView(auth, { start, end, top = 10 } = {}) {
  const startIso = toGraphDateTime(start);
  const endIso = toGraphDateTime(end);

  const path = `/me/calendarView?startDateTime=${encodeURIComponent(startIso)}&endDateTime=${encodeURIComponent(endIso)}&$top=${top}&$select=subject,organizer,start,end,location,isCancelled,isAllDay,onlineMeeting,webLink`;
  const res = await graphGet(auth, path);
  return res?.value || [];
}

export async function getUserCalendarView(auth, { userEmail, start, end, top = 10 } = {}) {
  const startIso = toGraphDateTime(start);
  const endIso = toGraphDateTime(end);

  const safeUser = encodeURIComponent(userEmail);
  const path = `/users/${safeUser}/calendarView?startDateTime=${encodeURIComponent(startIso)}&endDateTime=${encodeURIComponent(endIso)}&$top=${top}&$select=subject,organizer,start,end,location,isCancelled,isAllDay,webLink`;
  const res = await graphGet(auth, path);
  return res?.value || [];
}
