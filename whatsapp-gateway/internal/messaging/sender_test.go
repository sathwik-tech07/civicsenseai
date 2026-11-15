package messaging

import (
	"testing"
)

func TestCleanRecipient(t *testing.T) {
	cases := []struct {
		input    string
		expected string
		hasError bool
	}{
		{input: "+91 98765-43210", expected: "919876543210", hasError: false},
		{input: "919876543210@s.whatsapp.net", expected: "919876543210", hasError: false},
		{input: "1234567890", expected: "1234567890", hasError: false},
		{input: "123", expected: "", hasError: true},        // too short
		{input: "", expected: "", hasError: true},           // empty
		{input: "invalid-number", expected: "", hasError: true}, // non digits
	}

	for _, c := range cases {
		jid, err := CleanRecipient(c.input)
		if c.hasError {
			if err == nil {
				t.Errorf("CleanRecipient(%q) expected error, got nil", c.input)
			}
		} else {
			if err != nil {
				t.Errorf("CleanRecipient(%q) unexpected error: %v", c.input, err)
			}
			if jid.User != c.expected {
				t.Errorf("CleanRecipient(%q) user got %q, expected %q", c.input, jid.User, c.expected)
			}
		}
	}
}
