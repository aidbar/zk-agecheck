// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { SignedAgeData } from "@/types";
import { error } from "console";
import type { NextApiRequest, NextApiResponse } from "next";
import { Field, PrivateKey, Signature } from "o1js";
import { NextRequest, NextResponse } from "next/server";
import formidable, { IncomingForm, File } from "formidable";
import mime from "mime";
import { join } from "path";
import * as dateFn from "date-fns";
import { mkdir, stat } from "fs/promises";

interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    id: number;
  };
}

//export const FormidableError = formidable.errors.FormidableError;

export const parseForm = async (
  req: NextApiRequest
  //): Promise<{ fields: formidable.Fields; files: formidable.Files }> => { // FIXME
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    const uploadDir = join(
      process.env.ROOT_DIR || process.cwd(),
      `/uploads/${dateFn.format(Date.now(), "dd-MM-Y")}`
    );

    try {
      await stat(uploadDir);
    } catch (e: any) {
      if (e.code === "ENOENT") {
        await mkdir(uploadDir, { recursive: true });
      } else {
        console.error(e);
        reject(e);
        return;
      }
    }

    const form = formidable({
      maxFiles: 2,
      maxFileSize: 1024 * 1024, // 1mb
      uploadDir,
      filename: (_name, _ext, part) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const filename = `${part.name || "unknown"}-${uniqueSuffix}.${
          mime.getExtension(part.mimetype || "") || "unknown"
        }`;
        return filename;
      },
      filter: (part) => {
        return (
          part.name === "media" && (part.mimetype?.includes("image") || false)
        );
      },
    });

    form.parse(req, () => {
      //console.log("file contents", req.body);
      console.log(
        "Got file with content length about ",
        req.body.toString().length
      );
      resolve("dummy");
      // TODO: do something with the file
    });

    /* form.parse(req, function (err, fields, files) {
      if (err) reject(err);
      else resolve({ fields, files });
    }); */
  });
};

/* export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  console.log("FILEEEEEE", files);
} */

const handler = async (
  req: ExtendedNextApiRequest,
  res: NextApiResponse<SignedAgeData>
) => {
  try {
    //const { fields, files } = await parseForm(req);
    await parseForm(req);

    //console.log("DATAAAA", { fields, files });

    /* res.status(200).json({
      data: {
        url: "/uploaded-file-url",
      },
      error: null,
    }); */
  } catch (e) {
    console.error(e);
  }

  const oracle_key = process.env.ORACLE_PRIVATE_KEY;

  if (!oracle_key) {
    console.error("No oracle key set");
    throw error("No oracle key set");
  }

  //console.log("got req", req);

  const idStr = 1; //req.body.id;
  const ageNum = 78; // FIXME: should probably get the data from somewhere

  const id = Field(idStr);
  const age = Field(ageNum);

  const fields = [id, age];

  const signature = Signature.create(PrivateKey.fromBase58(oracle_key), fields);

  console.log("got sig", signature.toBase58());

  /* let sig =
    "7mXJiJsHzGHPFvJGF9hZpqc2qigR4GjFLJe6j56cwjwcT5LCKFPKQAzKNJs2g5JRHafqvWRPLuYDHJZhppuk9rYXnYipgocC"; */
  let data: SignedAgeData = {
    id: idStr,
    age: ageNum,
    sig: signature.toBase58(),
  };
  res.status(200).json(data);
};

export default handler;
