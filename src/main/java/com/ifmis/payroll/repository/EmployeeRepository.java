package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, String> {
    // Check duplicate email
    boolean existsByEmail(String email);

    // Check duplicate mobile
    boolean existsByMobileNumber(String mobileNumber);

    // Check duplicate civil service ID
    boolean existsByCivilServiceCardId(String civilServiceCardId);

    // Check duplicate social security
    boolean existsBySocialSecurityNumber(String socialSecurityNumber);

    // Check duplicate bank account
    boolean existsByAccountNumber(String accountNumber);
}
