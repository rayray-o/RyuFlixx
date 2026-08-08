"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useDisclosure, useInterval, useLocalStorage } from "@mantine/hooks";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  ScrollShadow,
} from "@heroui/react";
import { DISCLAIMER_STORAGE_KEY, IS_BROWSER } from "@/utils/constants";
import { cn } from "@/utils/helpers";

const COUNTDOWN_DURATION = 3;
const MODAL_SIZE = "3xl";
const DISCLAIMER_CONTENT = {
  title: "Disclaimer",
  paragraphs: [
    {
      id: "welcome",
      content:
        "Welcome to RyuFlix - a free movie streaming website. Please read this disclaimer carefully before using this website.",
    
    },
  ],
};

interface DisclaimerParagraphProps {
  content: string;
  emphasis?: string;
  continuation?: string;
}

const DisclaimerParagraph: React.FC<DisclaimerParagraphProps> = memo(
  ({ content, emphasis, continuation }) => (
    <p>
      {content}
      {emphasis && (
        <>
          {" "}
          <strong>{emphasis}</strong>
        </>
      )}
      {continuation && ` ${continuation}`}
    </p>
  ),
);

DisclaimerParagraph.displayName = "DisclaimerParagraph";

const Disclaimer: React.FC = () => {
  const [hasAgreed, setHasAgreed] = useLocalStorage<boolean>({
    key: DISCLAIMER_STORAGE_KEY,
    defaultValue: false,
    getInitialValueInEffect: false,
  });

  const [secondsRemaining, setSecondsRemaining] = useState(COUNTDOWN_DURATION);

  const shouldShowModal = useMemo(() => !hasAgreed && IS_BROWSER, [hasAgreed]);

  const [isOpen, { close }] = useDisclosure(shouldShowModal);

  useInterval(() => setSecondsRemaining((prev) => Math.max(0, prev - 1)), 1000, {
    autoInvoke: shouldShowModal && secondsRemaining > 0,
  });

  const isButtonDisabled = secondsRemaining > 0;
  const buttonText = useMemo(
    () => `Agree${isButtonDisabled ? ` (${secondsRemaining})` : ""}`,
    [isButtonDisabled, secondsRemaining],
  );

  const handleAgree = useCallback(() => {
    close();
    setHasAgreed(true);
  }, [close, setHasAgreed]);

  if (hasAgreed || !IS_BROWSER) {
    return null;
  }

  return (
    <Modal
      hideCloseButton
      isOpen={isOpen}
      placement="center"
      backdrop="blur"
      size={MODAL_SIZE}
      isDismissable={false}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 text-center text-3xl uppercase">
          {DISCLAIMER_CONTENT.title}
        </ModalHeader>

        <ModalBody>
          <ScrollShadow hideScrollBar className="space-y-4">
            {DISCLAIMER_CONTENT.paragraphs.map((paragraph: any) => (
              <DisclaimerParagraph
                key={paragraph.id}
                content={paragraph.content}
                emphasis={paragraph.emphasis}
                continuation={paragraph.continuation}
              />
            ))}
          </ScrollShadow>
        </ModalBody>

        <ModalFooter className="justify-center">
          <Button
            className={cn(isButtonDisabled && "pointer-events-auto cursor-not-allowed")}
            isDisabled={isButtonDisabled}
            color={isButtonDisabled ? "danger" : "primary"}
            variant="shadow"
            onPress={handleAgree}
          >
            {buttonText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default Disclaimer;
