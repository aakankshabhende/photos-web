import Box from "@mui/material/Box";
import { t } from "i18next";
import { GalleryContext } from "pages/gallery";
import { MouseEventHandler, useContext, useMemo } from "react";
import { Trans } from "react-i18next";
import { UserDetails } from "types/user";
import {
    hasAddOnBonus,
    hasExceededStorageQuota,
    hasPaidSubscription,
    hasStripeSubscription,
    isOnFreePlan,
    isSubscriptionActive,
    isSubscriptionCancelled,
} from "utils/billing";

import { Typography } from "@mui/material";
import LinkButton from "components/pages/gallery/LinkButton";
import billingService from "services/billingService";
import { isFamilyAdmin, isPartOfFamily } from "utils/user/family";

export default function SubscriptionStatus({
    userDetails,
}: {
    userDetails: UserDetails;
}) {
    const { showPlanSelectorModal } = useContext(GalleryContext);

    const hasAMessage = useMemo(() => {
        if (!userDetails) {
            return false;
        }
        if (
            isPartOfFamily(userDetails.familyData) &&
            !isFamilyAdmin(userDetails.familyData)
        ) {
            return false;
        }
        if (
            hasPaidSubscription(userDetails.subscription) &&
            !isSubscriptionCancelled(userDetails.subscription)
        ) {
            return false;
        }
        return true;
    }, [userDetails]);

    const handleClick = useMemo(() => {
        const eventHandler: MouseEventHandler<HTMLSpanElement> = (e) => {
            e.stopPropagation();
            if (userDetails) {
                if (isSubscriptionActive(userDetails.subscription)) {
                    if (hasExceededStorageQuota(userDetails)) {
                        showPlanSelectorModal();
                    }
                } else {
                    if (hasStripeSubscription(userDetails.subscription)) {
                        billingService.redirectToCustomerPortal();
                    } else {
                        showPlanSelectorModal();
                    }
                }
            }
        };
        return eventHandler;
    }, [userDetails]);

    if (!hasAMessage) {
        return <></>;
    }

    const messages = [];
    if (!hasAddOnBonus(userDetails.bonusData)) {
        if (isSubscriptionActive(userDetails.subscription)) {
            if (isOnFreePlan(userDetails.subscription)) {
                messages.push(
                    <Trans
                        i18nKey={"FREE_SUBSCRIPTION_INFO"}
                        values={{
                            date: userDetails.subscription?.expiryTime,
                        }}
                    />,
                );
            } else if (isSubscriptionCancelled(userDetails.subscription)) {
                messages.push(
                    t("RENEWAL_CANCELLED_SUBSCRIPTION_INFO", {
                        date: userDetails.subscription?.expiryTime,
                    }),
                );
            }
        } else {
            messages.push(
                <Trans
                    i18nKey={"SUBSCRIPTION_EXPIRED_MESSAGE"}
                    components={{
                        a: <LinkButton onClick={handleClick} />,
                    }}
                />,
            );
        }
    }

    if (hasExceededStorageQuota(userDetails) && messages.length === 0) {
        messages.push(
            <Trans
                i18nKey={"STORAGE_QUOTA_EXCEEDED_SUBSCRIPTION_INFO"}
                components={{
                    a: <LinkButton onClick={handleClick} />,
                }}
            />,
        );
    }

    return (
        <Box px={1} pt={0.5}>
            <Typography
                variant="small"
                color={"text.muted"}
                onClick={handleClick && handleClick}
                sx={{ cursor: handleClick && "pointer" }}
            >
                {messages}
            </Typography>
        </Box>
    );
}
