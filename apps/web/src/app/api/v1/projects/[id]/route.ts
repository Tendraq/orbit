import { api, findProject, projectJson } from "@/server/public-api";

export const GET = api({}, async (c, _req, p) => ({ data: projectJson(await findProject(c, p.id)) }));
