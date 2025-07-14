import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import axios from 'axios';

// --- Configuration ---
// Make sure your local development server IP is used here.
// On Android emulators, 'localhost' or '127.0.0.1' typically refers to the emulator's own loopback interface, not the host machine.
// Using 10.0.2.2 is the standard way to access the host machine from an Android emulator.
// If you are using a physical device, replace 10.0.2.2 with your computer's IP address on the same Wi-Fi network.
const API_URL = 'http://10.0.2.2:3000/api';

const LoginScreen = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert('Validation Error', 'Please enter both username and password.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.post(`${API_URL}/login`, {
                username,
                password,
            });

            // On successful login, the server responds with a token and user data.
            // For now, we'll just show an alert. In a real app, you would navigate
            // to the main part of the app and store the token securely.
            console.log('Login successful:', response.data);
            Alert.alert('Success', `Welcome, ${response.data.user.username}!`);

            // TODO: Navigate to the main screen and store the auth token
            // e.g., navigation.navigate('ScannerScreen');

        } catch (error) {
            console.error('Login failed:', error);

            let errorMessage = 'An unexpected error occurred. Please try again.';
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                errorMessage = error.response.data.error || 'Invalid credentials. Please try again.';
            } else if (error.request) {
                // The request was made but no response was received
                errorMessage = 'Could not connect to the server. Please check your network connection.';
            }
            
            Alert.alert('Login Failed', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Mobile Scanner Login</Text>
            <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!isLoading}
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isLoading}
            />
            {isLoading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : (
                <Button title="Login" onPress={handleLogin} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    input: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        borderRadius: 5,
        marginBottom: 12,
        paddingHorizontal: 8,
        backgroundColor: 'white',
    },
});

export default LoginScreen; 