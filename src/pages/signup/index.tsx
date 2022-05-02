import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from 'pages/_app';
import Container from 'components/Container';
import EnteSpinner from 'components/EnteSpinner';
import { getData, LS_KEYS } from 'utils/storage/localStorage';
import SignUp from 'components/SignUp';
import { PAGES } from 'constants/pages';
import Card from '@mui/material/Card';
import { CardContent } from '@mui/material';

export default function SignUpPage() {
    const router = useRouter();
    const appContext = useContext(AppContext);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        router.prefetch(PAGES.VERIFY);
        router.prefetch(PAGES.LOGIN);
        const user = getData(LS_KEYS.USER);
        if (user?.email) {
            router.push(PAGES.VERIFY);
        }
        setLoading(false);
        appContext.showNavBar(false);
    }, []);

    const login = () => {
        router.push(PAGES.LOGIN);
    };

    return (
        <Container style={{ alignItems: 'flex-end' }}>
            {loading ? (
                <EnteSpinner />
            ) : (
                <Card sx={{ maxWidth: '360px' }}>
                    <CardContent sx={{ py: 4, px: 2 }}>
                        <SignUp login={login} />
                    </CardContent>
                </Card>
            )}
        </Container>
    );
}
