package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.Employee;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
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

    @Query("""
            SELECT e FROM Employee e
            WHERE
                (COALESCE(:employeeCode, '') = '' OR e.employeeCode ILIKE CONCAT('%', :employeeCode, '%'))
            AND (COALESCE(:firstName, '') = '' OR e.firstName ILIKE CONCAT('%', :firstName, '%'))
            AND (COALESCE(:lastName, '') = '' OR e.lastName ILIKE CONCAT('%', :lastName, '%'))
            AND (COALESCE(:email, '') = '' OR e.email ILIKE CONCAT('%', :email, '%'))
            AND (COALESCE(:mobileNumber, '') = '' OR e.mobileNumber LIKE CONCAT('%', :mobileNumber, '%'))
            AND (
                COALESCE(:keyword, '') = '' OR
                e.employeeCode ILIKE CONCAT('%', :keyword, '%') OR
                e.firstName ILIKE CONCAT('%', :keyword, '%') OR
                e.lastName ILIKE CONCAT('%', :keyword, '%') OR
                e.email ILIKE CONCAT('%', :keyword, '%') OR
                e.mobileNumber LIKE CONCAT('%', :keyword, '%') OR
                e.position ILIKE CONCAT('%', :keyword, '%') OR
                e.division ILIKE CONCAT('%', :keyword, '%') OR
                e.professionCategory ILIKE CONCAT('%', :keyword, '%')
            )
            """)
    Page<Employee> searchEmployees(
            String keyword,
            String employeeCode,
            String firstName,
            String lastName,
            String email,
            String mobileNumber,
            Pageable pageable
    );
}
