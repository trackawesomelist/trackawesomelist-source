import { serve, serveDir } from "./deps.ts";
import { getPublicPath } from "./util.ts";
export default function servePublic() {
  serve((req) => {
    return serveDir(req, {
      fsRoot: getPublicPath(),
      showIndex: true,
    });
  });
}
