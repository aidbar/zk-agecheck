import { useEffect, useState } from "react";
import { PublicKey, Field, Signature, JsonProof, verify } from "o1js";
import styles from "../styles/Home.module.css";
import React from "react";
import { createPortal } from "react-dom";
import KYC from "./kyc";
import { SignedAgeData } from "@/types";
import { zkProgram } from "@/components/zkProgram";
import RestrictedWebsite, { MINIMUM_AGE } from "./website";

const ORACLE_PUBLIC_KEY =
  "B62qr22wafj4oAmPFdshY8Bwya3cYMshuY5pGuSeuJzYLdZHwD4rK2G";

enum ProofState {
  START,
  AT_KYC,
  SIG_RECEIVED,
  PROOF_GENERATED,
  PROOF_VERIFYING,
  ERROR,
}

export default function Enter() {
  const [proof, setProof] = useState<JsonProof>();
  const [verificationKey, setVerificationKey] = useState<string>();
  const [proofState, setProofState] = useState<ProofState>(ProofState.START);
  const [errorText, setErrorText] = useState<string>("");

  const MINIMUM_AGE_TEXT_LABEL = "You must be over " + MINIMUM_AGE + " years old to enter this site!"

  const setAgeData = async (ageData: SignedAgeData) => {
    if (ageData.age < MINIMUM_AGE) {
      setErrorText("Detected age is too low");
      setProofState(ProofState.ERROR);
      return;
    }
    setProofState(ProofState.SIG_RECEIVED);

    const zkProg = zkProgram;
    const vkJson = await zkProg.compile();
    setVerificationKey(vkJson.verificationKey.data);

    const res = await zkProg.verifyAge(
      Field(MINIMUM_AGE), // public
      PublicKey.fromBase58(ORACLE_PUBLIC_KEY),
      Field(ageData.id),
      Field(ageData.age),
      Signature.fromBase58(ageData.sig)
    );
    const proof = res.toJSON();

    console.log("Generated proof", res, proof.proof);

    setProofState(ProofState.PROOF_GENERATED);

    console.log("Verification key", vkJson);
    setProof(proof);
  };

  return (
    <>
      {proofState == ProofState.PROOF_VERIFYING && (
        <RestrictedWebsite
          proof={proof!}
          requiredAge={MINIMUM_AGE}
          verificationKey={verificationKey!}
        ></RestrictedWebsite>
      )}
      {proofState != ProofState.PROOF_VERIFYING && (
        <div className={styles.main} style={{ padding: 0 }}>
          <div className={styles.center} style={{ padding: 0 }}>
            <p className="h1 text-primary p-3">ZK Age Verifier</p>
            <p className="h3 text-danger text-center">{MINIMUM_AGE_TEXT_LABEL}</p>
            {proofState != ProofState.ERROR && (
              <p className="h5 text-primary text-center p-3">Use a KYC provider to prove your age securely.</p>
            )}
            {proofState == ProofState.START && (
              <button
                type="button" className="btn btn-primary"
                onClick={() => {
                  setProofState(ProofState.AT_KYC);
                }}
              >
                Open provider
              </button>
            )}
            {proofState == ProofState.AT_KYC && (
              <IFrame>
                <KYC setSig={setAgeData} />
              </IFrame>
            )}
            {proofState == ProofState.SIG_RECEIVED && (
              <div>
                <p>
                  Generating a proof based on the data from the identity
                  provider... This may take a minute or two. Please wait.
                </p>
              </div>
            )}
            {proofState == ProofState.PROOF_GENERATED &&
              proof &&
              verificationKey && (
                <div>
                  <div>
                    Generated proof:
                    {proof.proof.substring(0, 10) + "..."}
                  </div>

                  <button
                    className={styles.button}
                    onClick={() => {
                      setProofState(ProofState.PROOF_VERIFYING);
                    }}
                  >
                    Submit proof
                  </button>
                </div>
              )}
            {proofState == ProofState.ERROR && errorText && (
              <div>Error: {errorText}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// https://dev.to/graftini/rendering-in-an-iframe-in-a-react-app-2boa
function IFrame({ children }: { children: React.ReactNode }) {
  const [ref, setRef] = useState<HTMLIFrameElement | null>(null);
  const container = ref?.contentWindow?.document?.body;

  return (
    <iframe ref={(node) => setRef(node)} className={styles.kyc}>
      {container && createPortal(children, container)}
    </iframe>
  );
}
