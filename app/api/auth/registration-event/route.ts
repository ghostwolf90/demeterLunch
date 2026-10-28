import { forbiddenMutation, getAccountUser, isSameOriginMutation, privateJson } from "@/lib/account-auth";
import { clearRegistrationEventCookie, hasRegistrationEvent } from "@/lib/registration-event";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return forbiddenMutation();
  const isNewAccount = Boolean(await getAccountUser(request)) && await hasRegistrationEvent(request);
  return privateJson({ isNewAccount }, {
    headers: { "set-cookie": clearRegistrationEventCookie(request) },
  });
}
